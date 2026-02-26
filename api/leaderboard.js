import { put, list, del } from '@vercel/blob';

const STORE_PREFIX = 'leaderboard-store/';

async function getLeaderboard(topicId) {
    try {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        if (!token) return [];

        const prefix = `${STORE_PREFIX}${topicId}-`;
        const { blobs } = await list({ prefix, token });

        if (blobs.length > 0) {
            blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
            const response = await fetch(blobs[0].url, { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to fetch blob content');
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
}

async function saveLeaderboard(topicId, leaderboardData) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const prefix = `${STORE_PREFIX}${topicId}-`;
    const newFileName = `${prefix}${Date.now()}.json`;

    try {
        await put(newFileName, JSON.stringify(leaderboardData), {
            access: 'public',
            addRandomSuffix: false,
            token
        });

        // Cleanup old files for this topic
        const { blobs } = await list({ prefix, token });
        blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        const blobsToDelete = blobs.slice(3).map(b => b.url);

        if (blobsToDelete.length > 0) {
            await del(blobsToDelete, { token });
        }
    } catch (error) {
        console.error('Failed to save leaderboard:', error);
    }
}

export default async function handler(req, res) {
    const { action, topicId } = req.query;
    if (!topicId) return res.status(400).json({ error: 'topicId is required' });

    if (req.method === 'GET') {
        if (action === 'get') {
            const leaderboard = await getLeaderboard(topicId);
            return res.status(200).json(leaderboard);
        }
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (req.method === 'POST') {
        if (action === 'submit') {
            const { userId, username, clearTime } = req.body;
            if (!userId || !username || !clearTime) {
                return res.status(400).json({ error: 'Missing run data' });
            }

            const leaderboard = await getLeaderboard(topicId);

            // Add new score
            leaderboard.push({
                userId,
                username,
                clearTime,
                date: new Date().toISOString()
            });

            // Sort by clear time (ascending, faster is better)
            leaderboard.sort((a, b) => a.clearTime - b.clearTime);

            // Keep only top 50 (or 10)
            const topLeaderboard = leaderboard.slice(0, 50);
            await saveLeaderboard(topicId, topLeaderboard);

            return res.status(200).json({ message: 'Score submitted successfully', leaderboard: topLeaderboard });
        }
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
