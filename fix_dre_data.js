const fs = require('fs');

const filePath = 'src/components/VWFinancialDashboard/index.tsx';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Before count:', (content.match(/dreData\[\d+\]/g) || []).length);

// Replace all dreData[number] with safeDreData[number]
content = content.replace(/dreData\[(\d+)\]/g, 'safeDreData[$1]');

console.log('After count:', (content.match(/dreData\[\d+\]/g) || []).length);
console.log('safeDreData count:', (content.match(/safeDreData\[\d+\]/g) || []).length);

fs.writeFileSync(filePath, content);
console.log('File updated successfully');
