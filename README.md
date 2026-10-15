# Talkify

Talkify is a web application hosted on Render that facilitates seamless and interactive communication. It provides a user-friendly platform for discussions, chats, or any form of textual interaction.

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
- **User-Friendly Interface**: The application has an intuitive, premium glassmorphism interface.
- **Voice & Video Calls**: 1:1 calls straight between browsers (WebRTC), with camera switching, mute, reconnection after network drops, and call history in the chat.
- **Voice Messages**: Record and send voice notes with a waveform player.
- **Image Messages**: Send JPEG, PNG, WebP or GIF images (up to 2 MB) by picking, pasting or dragging them in. Images are resized in the browser, stripped of location data on the server, and only visible to the two people in the chat.
- **Installable App & Notifications**: Install Talkify to your home screen or desktop, and get push notifications for messages and missed calls.
- **Profiles**: Edit your name, bio and photo, and share a QR code that opens a chat with you.
- **Chat Tools**: Edit messages, link previews, and pin, mute or archive conversations.
- **Mobile-Optimized & Responsive Design**: The website is fully responsive and optimized for mobile devices, featuring a native-like experience with safe area insets and touch-friendly interactions.

## Tech Stack

- **Frontend**: [React.js](https://reactjs.org/), [Material UI (MUI)](https://mui.com/), [Zustand](https://zustand-demo.pmnd.rs/)
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
    git clone https://github.com/Abhay1006/talkify.git
    cd talkify
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Set up environment variables**:
    Create a `.env` file in the root directory:
    ```
    MONGO_DB_URI=your_mongodb_connection_string
    JWT_SECRET=a_long_random_secret

    # Optional: push notifications. Generate once with
    #   npx web-push generate-vapid-keys
    # and keep them stable (changing them breaks existing subscriptions).
    VAPID_PUBLIC_KEY=
    VAPID_PRIVATE_KEY=
    VAPID_SUBJECT=mailto:you@example.com

    # Optional: a TURN relay for calls on restrictive networks (JSON array of
    # RTCIceServer objects). Defaults to Google's public STUN servers.
    # ICE_SERVERS=[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
    ```

4. **Run the application**:
    ```bash
    npm run build   # installs everything and builds the frontend
    npm start
    ```
    The application runs at `http://localhost:5001`. For frontend development, run `npm run server` and `npm run dev --prefix frontend`, then open `http://localhost:3000`.

5. **Run the tests** (needs a MongoDB at `mongodb://127.0.0.1:27017`, or set `TEST_MONGO_URI`):
    ```bash
    npm test
    ```

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

