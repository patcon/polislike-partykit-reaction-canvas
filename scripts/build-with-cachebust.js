#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate a cache-busting version string (timestamp)
const buildTime = Date.now();

// Derive app title from the worker name in wrangler.jsonc (kebab-case → Title Case)
const wranglerConfig = fs.readFileSync(path.join(__dirname, '../wrangler.jsonc'), 'utf8');
const workerName = wranglerConfig.match(/"name":\s*"([^"]+)"/)[1];
const appTitle = workerName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

// Read the HTML template
const templatePath = path.join(__dirname, '../public/index.template.html');
const outputPath = path.join(__dirname, '../public/index.html');
let htmlContent = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders
htmlContent = htmlContent.replace(/\{\{BUILD_TIME\}\}/g, buildTime);
htmlContent = htmlContent.replace(/\{\{APP_TITLE\}\}/g, appTitle);

// Write the updated HTML to the output file
fs.writeFileSync(outputPath, htmlContent);

console.log(`Cache-busting version updated: ${buildTime}`);
console.log(`App title: ${appTitle}`);