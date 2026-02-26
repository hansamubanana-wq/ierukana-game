import { put, list, del } from '@vercel/blob';

const STORE_PREFIX = 'topics-store/';
const LEGACY_STORE_NAME = 'topics.json';

// Utility to get current topics from Blob
async function getTopics() {
    try {
        const token = process.env.BLOB_READ_WRITE_TOKEN;

        // Try the new timestamped store first
        const { blobs } = await list({ prefix: STORE_PREFIX, token });
        if (blobs.length > 0) {
            // Sort by uploadedAt descending to get the latest
            blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
            const response = await fetch(blobs[0].url, { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to fetch blob content from URL');
            return await response.json();
        }

        // Fallback to legacy static name
        const { blobs: legacyBlobs } = await list({ maxResults: 1, prefix: LEGACY_STORE_NAME, token });
        if (legacyBlobs.length > 0) {
            // Bypass Vercel Edge CDN cache by appending a timestamp
            const response = await fetch(legacyBlobs[0].url + '?_t=' + Date.now(), {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            if (!response.ok) throw new Error('Failed to fetch blob content from URL');
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Critical Error in getTopics:', error.message);
        throw error;
    }
}

// Ensure the storage exists and is updated
async function saveTopics(topicsData) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const newFileName = `${STORE_PREFIX}topics-${Date.now()}.json`;

    try {
        await put(newFileName, JSON.stringify(topicsData), {
            access: 'public',
            addRandomSuffix: false,
            token
        });

        // Clean up old files to prevent infinite growth (keep only the newest 3)
        const { blobs } = await list({ prefix: STORE_PREFIX, token });
        blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        const blobsToDelete = blobs.slice(3).map(b => b.url);

        if (blobsToDelete.length > 0) {
            await del(blobsToDelete, { token });
        }
    } catch (error) {
        console.error('Failed to save to Vercel Blob (Local Dev Crash Protection):', error);
        if (process.env.VERCEL_ENV !== 'production') {
            console.log('Skipping actual save in non-production due to Blob SDK crash bug on Windows.');
            return;
        }
        throw error;
    }
}

export default async function handler(req, res) {
    // Prevent caching deeply to allow real-time updates
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Enable CORS for flexibility
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    try {
        if (req.method === 'GET') {
            const topics = await getTopics();
            return res.status(200).json(topics);
        }

        if (req.method === 'POST') {
            const newTopic = req.body;

            if (!newTopic || !newTopic.id || !newTopic.title || !Array.isArray(newTopic.answers)) {
                return res.status(400).json({ error: 'Invalid topic format' });
            }

            const topics = await getTopics();
            topics.push(newTopic);
            await saveTopics(topics);

            return res.status(201).json({ message: 'Topic added successfully', topic: newTopic });
        }

        if (req.method === 'PUT') {
            const updatedTopic = req.body;

            if (!updatedTopic || !updatedTopic.id || !updatedTopic.title || !Array.isArray(updatedTopic.answers)) {
                return res.status(400).json({ error: 'Invalid topic format' });
            }
            const { authorId } = updatedTopic;

            const topics = await getTopics();
            const topicIndex = topics.findIndex(t => t.id === updatedTopic.id);

            if (topicIndex === -1) {
                return res.status(404).json({ error: 'Topic not found' });
            }

            // Check ownership if topic has an author
            const existingTopic = topics[topicIndex];
            if (existingTopic.authorId && existingTopic.authorId !== authorId) {
                return res.status(403).json({ error: 'You do not have permission to edit this topic.' });
            }

            topics[topicIndex] = updatedTopic;
            await saveTopics(topics);

            return res.status(200).json({ message: 'Topic updated successfully', topic: updatedTopic });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query; // in Vercel api, path params like /api/topics/[id].js OR query string /api/topics?id=xxx

            // To keep things simple and avoid dynamic routing folders initially, we'll accept ID in body or query
            let topicId = id;
            let authorId = req.query.authorId;
            if (!topicId && req.body && req.body.id) {
                topicId = req.body.id;
            }
            if (!authorId && req.body && req.body.authorId) {
                authorId = req.body.authorId;
            }

            if (!topicId) {
                return res.status(400).json({ error: 'Topic ID is required' });
            }

            let topics = await getTopics();
            const initialLength = topics.length;

            topics = topics.filter(t => t.id !== topicId);

            if (topics.length === initialLength) {
                return res.status(404).json({ error: 'Topic not found' });
            }

            await saveTopics(topics);
            return res.status(200).json({ message: 'Topic deleted successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
