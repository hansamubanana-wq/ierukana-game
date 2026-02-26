const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

// To run this, you need to set process.env.BLOB_READ_WRITE_TOKEN
async function initBlob() {
    try {
        const dataPath = path.join(__dirname, 'topics.json');
        const topicsData = fs.readFileSync(dataPath, 'utf8');

        console.log('Uploading initial topics.json to Vercel Blob...');
        const result = await put('topics.json', topicsData, {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true
        });
        console.log('Successfully uploaded topics.json to:', result.url);
    } catch (error) {
        console.error('Error uploading initialization data:', error);
    }
}

initBlob();

