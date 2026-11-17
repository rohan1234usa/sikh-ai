// The words of the Learn Punjabi pages (/learn), in English: the pages
// around the lessons and vocabulary, which are English in every UI language
// (lib/learn/content/). Like Talk's (../talk) and the Seva pages' (../seva),
// they live apart from the dictionaries, which every page sends to the
// browser. Learn's layout (app/[lang]/learn/layout.tsx) reads them with
// getLearnCopy() (./index.ts) and hands them to LearnCopyProvider
// (app/components/learn/LearnCopy.tsx), so each Learn page carries its own
// language's words and no other page carries any. Client components read them
// with useLearnCopy(); server components take them as a prop. The i18n audit
// checks them with the rest of the site's strings, under `learn.` The link to
// Learn, its title and description, and the tutor route's error messages stay
// in the dictionaries, which the navbar, the home page and the server read.
// Relative type imports only: the audit runs this file under tsx.

import type { Gender, PartOfSpeech, TrackId, VocabTopicId } from '../../learn/config';

const learn = {
    title: 'Learn {word}',
    titleWord: 'Punjabi',
    subtitle: 'For Punjabi Americans who grew up hearing it: read Gurmukhi, see how sentences work, and learn the words you use with family.',
    caveat: 'Lessons are AI-drafted and waiting for review by fluent speakers.',
    breadcrumbAria: 'Breadcrumb',
    tracks: {
        script: {
            title: 'Gurmukhi script',
            desc: 'The alphabet, the vowel signs and the tones, until you can read the words you already know.',
        },
        grammar: {
            title: 'Grammar',
            desc: 'How Punjabi sentences work, from word order to why it’s kita and not kiti.',
        },
        vocab: {
            title: 'Vocabulary',
            desc: 'Everyday words by topic, with flashcards that come back just before you’d forget them.',
        },
        tutor: {
            title: 'Punjabi tutor',
            desc: 'Ask about any sentence, find out how to say anything, or practice a conversation.',
        },
    } satisfies Record<TrackId, { title: string; desc: string }>,
    topics: {
        'family': 'Family',
        'greetings': 'Greetings and manners',
        'gurdwara': 'Gurdwara and seva',
        'food': 'Food and the kitchen',
        'home': 'Home and the daily routine',
        'numbers-time': 'Numbers and time',
        'body-health': 'Body and health',
        'feelings': 'Feelings and small talk',
        'describing': 'Colors and describing words',
        'verbs': 'Everyday verbs',
    } satisfies Record<VocabTopicId, string>,
    partsOfSpeech: {
        noun: 'noun',
        verb: 'verb',
        adjective: 'adjective',
        adverb: 'adverb',
        number: 'number',
        phrase: 'phrase',
    } satisfies Record<PartOfSpeech, string>,
    genders: {
        m: 'masculine',
        f: 'feminine',
    } satisfies Record<Gender, string>,
    hub: {
        // The Today panel's rubric, then what kind of step it holds.
        today: 'Today',
        continue: 'Continue',
        start: 'Start here',
        upNext: 'Up next',
        allDone: 'You’ve finished every lesson',
        allDoneBody: 'Keep your words fresh with flashcards.',
        openLesson: 'Open lesson',
        open: 'Open',
        // Where each track fits, by starting point. Only the default
        // learner's order (grew up hearing it) exists until the
        // starting-point chooser (#66, step 3).
        order: {
            default: {
                script: 'Start here',
                grammar: 'Alongside the script lessons',
                vocab: 'Once you can read a few words',
                tutor: 'Any time',
            },
        } satisfies Record<'default', Record<TrackId, string>>,
        // A track's first milestone, shown in place of its count until
        // it is reached: a lesson track's first lesson, ten words.
        milestones: {
            script: 'Read your first word',
            grammar: 'Make your first sentence',
            vocab: 'Learn your first {n} words',
        } satisfies Record<Exclude<TrackId, 'tutor'>, string>,
        lessonsDone: 'Lessons done: {done} of {total}',
        wordsLearned: 'Words learned: {n} of {total}',
        // The hub's foot: where progress is kept, and resetting it.
        aboutProgress: 'About your progress',
        savedHere: 'Your progress is saved in this browser only.',
        reset: 'Reset progress',
        resetPrompt: 'Clear every lesson, score and flashcard?',
        resetConfirm: 'Reset',
        cancel: 'Cancel',
    },
    lesson: {
        lessonOf: 'Lesson {n} of {total}',
        best: 'Best score {correct} of {total}',
        done: 'Done',
        previous: 'Previous',
        next: 'Next',
        allLessons: 'All lessons',
        pagerAria: 'Previous and next lesson',
        tip: 'Tip',
        lettersAria: 'Letters',
        examplesAria: 'Examples',
        askTutor: 'Ask the tutor about this lesson',
        // How far into a lesson the learner has read: its checkpoints.
        sectionOf: 'Section {n} of {total}',
        atQuiz: 'Ready for the quiz',
        // The outline under a lesson's title. Plural only: every lesson
        // has two sections or more (tests/learn/content.test.ts).
        outline: 'In this lesson',
        outlineSummary: '{n} sections · about {min} min',
        // How long a lesson takes: 200 words a minute, 20 seconds a question.
        minutes: 'About {n} min',
        minutesLeft: 'About {n} min left',
        sectionMinutes: '{n} min',
        underAMinute: 'under 1 min',
        skipToQuiz: 'Skip to the quiz',
    },
    quiz: {
        heading: 'Check yourself',
        questionN: 'Question {n}',
        typedLabel: 'Your answer',
        typedPlaceholder: 'Type it in English letters',
        // Above a quiz's first typed question; the examples are pairs
        // lib/learn/quiz.ts (foldRoman) really grades the same.
        typedHint: 'Type it the way you’d text it. Spelling is forgiving: roti or rotee, achha or acha.',
        // Under a question graded strictly (TypedQuestion.strict).
        strictNote: 'Vowel length and doubled letters count on this one.',
        // After a miss: the other spellings a typed question takes.
        alsoAccepted: 'Also accepted: {spellings}',
        // Each question is checked on its own; its button is named with
        // its number, since a quiz has six to ten alike.
        check: 'Check',
        checkAria: 'Check question {n}',
        progress: '{n} of {total} checked',
        checkRest: 'Check the rest',
        tryAgain: 'Try again',
        newQuestions: 'New questions',
        correct: 'Correct',
        incorrect: 'Not quite',
        unanswered: 'Not answered',
        answer: 'Answer: {answer}',
        score: 'You got {correct} of {total}.',
        lessonDone: 'Lesson complete. Your best: {correct} of {total}.',
        vocabMeaning: 'What does this mean?',
        vocabSay: 'How do you say “{english}” in Punjabi?',
    },
    vocab: {
        wordCount: '{n} words',
        topicDescription: '{topic}: {n} Punjabi words in Gurmukhi, romanized Punjabi and English, with flashcards and a quiz.',
        modesAria: 'How to practice',
        modes: {
            words: 'Words',
            cards: 'Flashcards',
            quiz: 'Quiz',
        },
        due: 'Due: {n}',
        fresh: 'New: {n}',
        learned: 'Learned: {n}',
        example: 'Example',
    },
    cards: {
        directionAria: 'Which side to show first',
        punjabiFirst: 'Punjabi first',
        englishFirst: 'English first',
        show: 'Show answer',
        knewIt: 'I knew it',
        notYet: 'Not yet',
        progress: 'Card {n} of {total}',
        doneTitle: 'Session done',
        doneBody: 'Known: {right}. To see again: {wrong}.',
        again: 'Review again',
        nothingDue: 'Nothing is due. Every card here is scheduled for later.',
        // In its place once cards come due on a page left open.
        dueNow: 'Due now: {n}. Check again to start.',
        practice: 'Practice anyway',
        checkAgain: 'Check again',
    },
    // /learn/review: every topic's due flashcards, twenty a session.
    review: {
        title: 'Flashcard review',
        description: 'Every flashcard that is due, from every topic, the ones you know least first.',
        eyebrow: 'Every topic',
        lead: 'The cards due from every topic, the ones you know least first. Each card says which topic it is from.',
        // True for a learner who has met no card, some, or every one.
        nothingDue: 'Nothing is due from any topic. Each card comes back here on its day.',
        practiceTopic: 'Practice a topic instead',
        // The way in, on the hub and the vocabulary page. Two strings,
        // since fmt has no plurals.
        dueOne: 'Review 1 card due',
        dueMany: 'Review {n} cards due',
        // In the button's place while nothing is due, so nothing moves.
        noneDue: 'No flashcards are due right now.',
    },
    // /learn/tutor: the Punjabi tutor, a conversation kept in the tab.
    tutor: {
        greeting: 'Sat Sri Akal! I’m your Punjabi tutor. Ask me about any sentence, ask how to say something, or practice a conversation with me. Every bit of Punjabi comes in Gurmukhi, in English letters, and in English.',
        starters: [
            'How do I say “I’m running late” in Punjabi?',
            'Why is it kita and not kiti?',
            'Quiz me on family words',
            'Practice: ordering food at a dhaba',
        ],
        lessonStarters: [
            'Explain this lesson another way',
            'Quiz me on this lesson',
            'Give me three more examples like these',
        ],
        aboutLesson: 'Lesson: {title}',
        stopLessonAria: 'Stop using this lesson',
        lessonNotFound: 'The lesson in that link wasn’t found, so the tutor starts without one.',
        newConversation: 'New conversation',
        inputPlaceholder: 'Ask about Punjabi, or write in Punjabi…',
        messageAria: 'Message to the tutor',
        sendAria: 'Send message',
        stopAria: 'Stop the reply',
        thinking: 'The tutor is thinking',
        interrupted: 'Reply cut short',
        stopped: 'Stopped before the tutor replied',
        retry: 'Retry',
        copyAria: 'Copy reply',
        copiedAria: 'Copied',
        latest: 'Latest',
        charCount: '{n} / {max}',
        charLimit: 'Character limit reached: {max}',
        disclaimer: 'The tutor can make mistakes, so check with a fluent speaker. Each message goes to Google Gemini with your recent conversation, which is kept only in this tab.',
    },
};

export type LearnCopy = typeof learn;
export default learn;
