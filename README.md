# Sikh AI 🪯

**Bridging Heritage and Technology.**
Sikh AI is a comprehensive web application designed to serve the Sikh community by leveraging modern web technologies and Artificial Intelligence. It provides a peaceful, accessible digital space for daily prayers, community organization, and spiritual guidance grounded strictly in Sikh teachings.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Firebase](https://img.shields.io/badge/Firebase-Verified-orange)
![Gemini](https://img.shields.io/badge/AI-Gemini%20Pro-blueviolet)

## ✨ Core Features

* **📜 Daily Hukamnama:** Real-time fetching of the daily Hukamnama from Darbar Sahib (Golden Temple) with synchronized English and Punjabi translations.
* **🤖 Sikh AI Chatbot:** A RAG (Retrieval-Augmented Generation) chatbot powered by **Google Gemini**. It provides answers and advice rooted strictly in the *Guru Granth Sahib* and *Rehat Maryada*, minimizing hallucinations and maintaining theological accuracy.
* **🔍 Shabad Search:** A robust search engine allowing users to find hymns by keyword, Ang (page number), or writer.
* **🤝 Seva Event Organizer:** A community board for organizing and signing up for volunteer (Seva) events, managed via Firebase Auth and Firestore.

## 🛠️ Tech Stack

This project is built on a robust, scalable architecture utilizing the full Google Cloud ecosystem.

* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS.
* **Backend:** Firebase (Serverless).
* **Database:** Cloud Firestore.
* **Authentication:** Firebase Auth.
* **AI & Logic:** Google Cloud Functions, Vertex AI (Gemini Pro).

## 🎨 Design System

The UI is designed to be modern yet deeply respectful of Sikh culture, utilizing a high-contrast, accessible palette.

| Color Name | Hex Code | Usage |
| :--- | :--- | :--- |
| **Nihang Navy** | `#1B2A41` | Primary Backgrounds / Text |
| **Kesri Saffron** | `#FF9933` | Primary Buttons / Highlights |
| **Divine Gold** | `#D4AF37` | Accents / Borders / Icons |
| **Parchment White**| `#F8F9FA` | Text on Dark / Cards |
| **Slate Grey** | `#64748B` | Secondary Text |

## 🚀 Getting Started

### Prerequisites
* Node.js 18+
* A Google Cloud Project with billing enabled (for Maps & Vertex AI).
* A Firebase project.

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/yourusername/sikh-ai.git](https://github.com/yourusername/sikh-ai.git)
    cd sikh-ai
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env.local` file in the root directory and add your API keys:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_maps_key
    GOOGLE_GEMINI_API_KEY=your_gemini_key
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure
