# Talkify

Talkify is a minimal real-time chat application hosted on Render. The interface is deliberately plain — no imagery, no decoration, just the conversation.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Real-Time Communication**: Users can chat and interact in real-time via WebSockets.
- **Minimal Interface**: A deliberately plain, text-first UI — flat surfaces, system fonts, no imagery or decoration. Consecutive messages from the same sender are grouped into one block.
- **Light & Dark Themes**: Follows the operating system by default, with a toggle that persists the choice.
- **No UI Framework**: The interface is plain semantic HTML and a single stylesheet of CSS custom properties, so there is no runtime styling work on the critical path.
- **Mobile-Optimized & Responsive Design**: One pane at a time on narrow screens, with safe area insets and touch-friendly targets.

## Tech Stack

- **Frontend**: [React.js](https://reactjs.org/), [Zustand](https://zustand-demo.pmnd.rs/), [TanStack Query](https://tanstack.com/query), plain CSS
- **Backend**: [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/), [Socket.io](https://socket.io/)
- **Database**: [MongoDB](https://www.mongodb.com/)
- **Hosting**: [Render](https://render.com/)

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) installed on your machine.
- [MongoDB](https://www.mongodb.com/try/download/community) set up locally or using MongoDB Atlas.

### Steps

1. **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/talkify.git
    cd talkify
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Set up environment variables**:
    Create a `.env` file in the root directory and add the following:
    ```
    DATABASE_URL=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_key
    ```

4. **Run the application**:
    ```bash
    npm start
    ```
    The application will run at `http://localhost:3000`.

## Usage

- Visit [Talkify](https://talkify-etjd.onrender.com/) to start interacting.
- Sign up or log in to join conversations.

## Deployment

The application is deployed on [Render](https://render.com/). Follow these steps to deploy:

1. Connect your repository to Render.
2. Set up environment variables on Render's dashboard.
3. Deploy the app from Render’s dashboard.

## Contributing

We welcome contributions to improve Talkify! If you have suggestions or find issues, feel free to open a pull request or submit an issue.

## App useage-


https://github.com/user-attachments/assets/2442fc8a-6647-4cab-b3e5-15b07d6c0b99

