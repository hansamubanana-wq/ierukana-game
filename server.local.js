const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'topics.json');

app.use(cors());
app.use(express.json());
// Serve static files from the same directory
app.use(express.static(__dirname));

// Read topics
app.get('/api/topics', (req, res) => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return res.json([]);
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('Error reading topics:', err);
        res.status(500).json({ error: 'Failed to read topics data' });
    }
});

// Add new topic
app.post('/api/topics', (req, res) => {
    try {
        const newTopic = req.body;
        
        // Basic validation
        if (!newTopic || !newTopic.id || !newTopic.title || !Array.isArray(newTopic.answers)) {
            return res.status(400).json({ error: 'Invalid topic format' });
        }

        let topics = [];
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            topics = JSON.parse(data);
        }

        topics.push(newTopic);
        
        // Save back to file
        fs.writeFileSync(DATA_FILE, JSON.stringify(topics, null, 2), 'utf8');
        
        res.status(201).json({ message: 'Topic added successfully', topic: newTopic });
    } catch (err) {
        console.error('Error saving topic:', err);
        res.status(500).json({ error: 'Failed to save topic data' });
    }
});

// Delete a topic
app.delete('/api/topics/:id', (req, res) => {
    try {
        const topicId = req.params.id;
        
        if (!fs.existsSync(DATA_FILE)) {
            return res.status(404).json({ error: 'Topics file not found' });
        }
        
        let topics = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const initialLength = topics.length;
        
        topics = topics.filter(t => t.id !== topicId);
        
        if (topics.length === initialLength) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(topics, null, 2), 'utf8');
        res.json({ message: 'Topic deleted successfully' });
    } catch (err) {
        console.error('Error deleting topic:', err);
        res.status(500).json({ error: 'Failed to delete topic data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
