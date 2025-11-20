#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate a cache-busting version string (timestamp)
const buildTime = Date.now();

// Read the HTML template
const templatePath = path.join(__dirname, '../public/index.template.html');
const outputPath = path.join(__dirname, '../public/index.html');
let htmlContent = fs.readFileSync(templatePath, 'utf8');

// Replace the placeholder with actual build time
htmlContent = htmlContent.replace(/\{\{BUILD_TIME\}\}/g, buildTime);

// Write the updated HTML to the output file
fs.writeFileSync(outputPath, htmlContent);

console.log(`Cache-busting version updated: ${buildTime}`);