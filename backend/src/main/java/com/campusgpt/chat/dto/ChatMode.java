package com.campusgpt.chat.dto;

/**
 * Smart answer modes for the CampusGPT chat system.
 * Each mode injects a different system prompt to guide the LLM's response style.
 */
public enum ChatMode {

    /** Provides a clear, thorough conceptual explanation with analogies */
    EXPLAIN_CONCEPT,

    /** Produces a structured 10-mark exam-style answer with intro, points, and conclusion */
    TEN_MARK,

    /** Generates concise, bullet-point short notes for quick revision */
    SHORT_NOTES,

    /** Generates likely viva questions and model answers */
    VIVA,

    /** Produces rapid-fire revision summaries */
    REVISION_BLAST,

    /** Suggests what to focus on for upcoming exams */
    EXAM_STRATEGY
}
