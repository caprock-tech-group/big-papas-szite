"use client";

import { useMemo, useState } from "react";
import { quizQuestions, taterSlugs, type TaterSlug } from "./quiz-data";
import styles from "./quiz.module.css";

type ScoreCard = Record<TaterSlug, number>;

function emptyScores(): ScoreCard {
  return Object.fromEntries(taterSlugs.map((slug) => [slug, 0])) as ScoreCard;
}

function winningTater(scores: ScoreCard) {
  return taterSlugs.reduce((winner, slug) => (
    scores[slug] > scores[winner] ? slug : winner
  ), taterSlugs[0]);
}

export function TaterQuiz() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [scores, setScores] = useState<ScoreCard>(emptyScores);
  const [isMoving, setIsMoving] = useState(false);
  const question = quizQuestions[questionIndex];
  const progress = ((questionIndex + 1) / quizQuestions.length) * 100;
  const questionNumber = questionIndex + 1;

  const progressLabel = useMemo(
    () => `${questionNumber} of ${quizQuestions.length}`,
    [questionNumber],
  );

  function chooseAnswer(answerScores: Partial<Record<TaterSlug, number>>) {
    if (isMoving) return;
    setIsMoving(true);

    const nextScores = { ...scores };
    for (const [slug, points] of Object.entries(answerScores)) {
      nextScores[slug as TaterSlug] += points || 0;
    }
    setScores(nextScores);

    window.setTimeout(() => {
      if (questionIndex === quizQuestions.length - 1) {
        window.location.assign(`/fun/which-tater/${winningTater(nextScores)}`);
        return;
      }
      setQuestionIndex((current) => current + 1);
      setIsMoving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 220);
  }

  function startOver() {
    setScores(emptyScores());
    setQuestionIndex(0);
    setIsMoving(false);
  }

  return (
    <section className={styles.quizPanel} aria-live="polite">
      <div className={styles.progressHeader}>
        <span>{progressLabel}</span>
        <button type="button" onClick={startOver} disabled={questionIndex === 0}>Start over</button>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className={`${styles.question} ${isMoving ? styles.questionMoving : ""}`}>
        <p>{question.eyebrow}</p>
        <h2>{question.prompt}</h2>
        <div className={styles.answers}>
          {question.answers.map((answer, index) => (
            <button
              type="button"
              className={styles.answer}
              key={answer.label}
              onClick={() => chooseAnswer(answer.scores)}
              disabled={isMoving}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              <strong>{answer.label}</strong>
              <small>{answer.detail}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

