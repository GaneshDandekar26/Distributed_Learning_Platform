# Distributed LearnHub

## Project Structure

```
DISTRIBUTED_LEARNING_PLATFORM/
│
├── frontend/          # React + TypeScript frontend application
├── backend/           # Distributed Python backend system
│   ├── DLH_Project/  # (To be added)
│   └── docker-compose.yml
│
└── README.md
```

## Project info

A modern distributed learning platform with real-time whiteboard collaboration, chat with Lamport timestamps, and comprehensive distributed systems monitoring.

## How can I edit this code?

**Use your preferred IDE**

Clone this repo and push changes using your preferred development environment.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd Distributed_Learning_Platform

# Step 3: Navigate to frontend directory and install dependencies.
cd frontend
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

You can deploy this project using various hosting services like Vercel, Netlify, or any other platform that supports Vite applications.

Build the project with `npm run build` and deploy the `dist` folder.
