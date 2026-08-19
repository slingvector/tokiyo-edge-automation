const xlsx = require('xlsx');

function extractLinkedInUrls(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['TOP POSTS'];
    const data = xlsx.utils.sheet_to_json(sheet);
    // The URLs are in the column '__EMPTY_3' starting from row 1 (0 is header)
    const urls = data.filter(row => {
        const val = row['__EMPTY_3'];
        return val && typeof val === 'string' && val.startsWith('https://www.linkedin.com/posts');
    }).map(row => row['__EMPTY_3']);
    return urls;
}

module.exports = { extractLinkedInUrls };
