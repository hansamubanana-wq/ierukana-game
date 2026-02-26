import { put, list, del } from '@vercel/blob';
import crypto from 'crypto';

const STORE_PREFIX = 'users-store/';

async function getUsers() {
    try {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        if (!token) return [];

        const { blobs } = await list({ prefix: STORE_PREFIX, token });
        if (blobs.length > 0) {
            blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
            const response = await fetch(blobs[0].url, { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to fetch blob content');
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

async function saveUsers(usersData) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const newFileName = `${STORE_PREFIX}users-${Date.now()}.json`;

    try {
        await put(newFileName, JSON.stringify(usersData), {
            access: 'public',
            addRandomSuffix: false,
            token
        });

        // Cleanup old files
        const { blobs } = await list({ prefix: STORE_PREFIX, token });
        blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        const blobsToDelete = blobs.slice(3).map(b => b.url);

        if (blobsToDelete.length > 0) {
            await del(blobsToDelete, { token });
        }
    } catch (error) {
        console.error('Failed to save users:', error);
    }
}

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

export default async function handler(req, res) {
    const { action } = req.query;

    if (req.method === 'POST') {
        if (action === 'register') {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'ユーザー名とパスワードが必要です' });

            const users = await getUsers();
            if (users.find(u => u.username === username)) {
                return res.status(400).json({ error: 'このユーザー名はすでに使われています' });
            }

            const newUser = {
                id: crypto.randomUUID(),
                username,
                passwordHash: hashPassword(password),
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            await saveUsers(users);

            return res.status(200).json({ message: '登録成功', user: { id: newUser.id, username: newUser.username } });
        }

        else if (action === 'login') {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'ユーザー名とパスワードが必要です' });

            const users = await getUsers();
            const user = users.find(u => u.username === username);

            if (!user || user.passwordHash !== hashPassword(password)) {
                return res.status(401).json({ error: 'ユーザー名かパスワードが違います' });
            }

            return res.status(200).json({ message: 'ログイン成功', user: { id: user.id, username: user.username } });
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
