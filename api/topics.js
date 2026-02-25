import { put, list } from '@vercel/blob';

const STORE_NAME = 'topics.json';

// Utility to get current topics from Blob
async function getTopics() {
    try {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        // In local Vercel dev on some Windows machines, reading from Blob fails or crashes.
        // If we can't read, we'll try to return empty so at least it doesn't 500.
        const { blobs } = await list({ maxResults: 1, prefix: STORE_NAME, token });
        if (blobs.length > 0) {
            // Vercel's Node.js fetch caches aggressively by default, so we force no-store
            const response = await fetch(blobs[0].url, { cache: 'no-store' });
            return await response.json();
        }
        return [];
    } catch (error) {
        console.warn('Warning: Could not read from Vercel Blob (might be local dev environment issue):', error.message);
        // Fallback for local dev if blob is inaccessible
        return [
            { id: "prefectures", title: "日本の都道府県 (Fallback)", answers: [["北海道", "ほっかいどう"]] }
        ];
    }
}

// Ensure the storage exists and is updated
async function saveTopics(topicsData) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    try {
        await put(STORE_NAME, JSON.stringify(topicsData), {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
            token
        });
    } catch (error) {
        console.error('Failed to save to Vercel Blob (Local Dev Crash Protection):', error);
        // We catch here to prevent the 500 error from bubbling up immediately,
        // allowing the frontend to at least receive a 201 success (even if ephemeral locally).
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

        if (req.method === 'DELETE') {
            const { id } = req.query; // in Vercel api, path params like /api/topics/[id].js OR query string /api/topics?id=xxx

            // To keep things simple and avoid dynamic routing folders initially, we'll accept ID in body or query
            let topicId = id;
            if (!topicId && req.body && req.body.id) {
                topicId = req.body.id;
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
