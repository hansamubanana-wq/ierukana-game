import { put, list } from '@vercel/blob';

const STORE_NAME = 'topics.json';

// Utility to get current topics from Blob
async function getTopics() {
    try {
        const { blobs } = await list({ maxResults: 1, prefix: STORE_NAME });
        if (blobs.length > 0) {
            const response = await fetch(blobs[0].url);
            return await response.json();
        }

        // If not found, return empty array (or initialize with default topics if we wanted)
        return [];
    } catch (error) {
        console.error('Error reading from blob:', error);
        return [];
    }
}

// Ensure the storage exists and is updated
async function saveTopics(topicsData) {
    await put(STORE_NAME, JSON.stringify(topicsData), {
        access: 'public',
        addRandomSuffix: false // We want to overwrite the same file
    });
}


export default async function handler(req, res) {
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
