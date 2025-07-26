#!/bin/bash

# Install missing dependencies for job queue enhancements
cd apps/api

echo "Installing WebSocket dependencies..."
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io

echo "Installing export/analytics dependencies..."
pnpm add exceljs csv-writer

echo "Dependencies installed successfully!"
echo "Please restart your development server if it's running."