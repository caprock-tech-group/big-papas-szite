import type { Metadata } from "next";
import { TaterQuiz } from "./quiz-client";
import styles from "./quiz.module.css";

export const metadata: Metadata = {
  title: "Which Big Papa's Tater Are You?",
  description: "Take Big Papa's loaded tater personality quiz and find your perfect potato.",
  robots: { index: false, follow: false },
};

export default function TaterQuizPage() {
  return (
    <main className={styles.quizPage}>
      <div className={styles.texture} aria-hidden="true" />
      <header className={styles.quizHeader}>
        <a href="/" aria-label="Back to Big Papa's home page">
          <img src="/images/big-papas-logo.webp" alt="Big Papa's Texas Loaded Potatoes" width="900" height="900" />
        </a>
        <div>
          <p>Big Papa&apos;s personality test</p>
          <h1>Which loaded tater are you?</h1>
          <span>Six questions. One delicious destiny.</span>
        </div>
      </header>
      <TaterQuiz />
      <footer className={styles.quizFooter}>
        <span>★</span> Big portions. Bold flavor. Texas style. <span>★</span>
      </footer>
    </main>
  );
}

