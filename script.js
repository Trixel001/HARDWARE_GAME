document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const skillMapContainer = document.getElementById('skill-map-container');
    const lessonContainer = document.getElementById('lesson-container');
    const skillMap = document.getElementById('skill-map');
    const lessonTitleEl = document.getElementById('lesson-title');
    const questionContainer = document.getElementById('question-container');
    const checkAnswerBtn = document.getElementById('check-answer-btn');
    const feedback = document.getElementById('feedback');
    const scoreEl = document.getElementById('score');
    const livesEl = document.getElementById('lives');
    const practiceBtn = document.getElementById('practice-btn');


    // --- Game State ---
    let lessonsData = null;
    let currentSkill = null;
    let currentLesson = null;
    let currentExerciseIndex = 0;
    let score = 0;
    let lives = 5;
    let userProgress = {
        unlockedSkills: ['skill-1'],
        completedLessons: [],
        exercisePerformance: {} // Tracks performance for spaced repetition
    };

    // --- Core Functions ---

    /**
     * Fetches lesson data and initializes the game.
     */
    async function initializeGame() {
        try {
            const response = await fetch('lessons.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            lessonsData = await response.json();

            loadProgress();
            showSkillMap();
        } catch (error) {
            console.error("Failed to load lesson data:", error);
            skillMapContainer.innerHTML = "<h2>Oops!</h2><p>Failed to load game content. Please try refreshing the page.</p>";
        }
    }

    /**
     * Switches the view to the skill map and renders it.
     */
    function showSkillMap() {
        lessonContainer.classList.remove('active');
        skillMapContainer.classList.add('active');
        renderSkillMap();
        updatePracticeButton();
    }

    /**
     * Switches the view to the lesson container.
     */
    function showLessonView() {
        skillMapContainer.classList.remove('active');
        lessonContainer.classList.add('active');
        lessonTitleEl.textContent = currentLesson.title;
        displayCurrentExercise();
    }


    /**
     * Renders the skill nodes on the map based on user progress.
     */
    function renderSkillMap() {
        skillMap.innerHTML = '';
        lessonsData.skills.forEach(skill => {
            const skillNode = document.createElement('div');
            skillNode.classList.add('skill-node');
            skillNode.textContent = skill.title;
            skillNode.dataset.skillId = skill.id;

            const lessonsInSkill = skill.lessons.map(l => l.id);
            const allLessonsCompleted = lessonsInSkill.length > 0 && lessonsInSkill.every(lId => userProgress.completedLessons.includes(lId));

            if (userProgress.unlockedSkills.includes(skill.id)) {
                skillNode.classList.add('unlocked');
                if (allLessonsCompleted) {
                    skillNode.classList.add('completed');
                }
            } else {
                skillNode.classList.add('locked');
            }
            skillMap.appendChild(skillNode);
        });
    }

    /**
     * Starts a specific lesson.
     * @param {string} skillId The ID of the skill.
     * @param {string} lessonId The ID of the lesson.
     */
    function startLesson(skillId, lessonId) {
        currentSkill = lessonsData.skills.find(s => s.id === skillId);
        currentLesson = currentSkill.lessons.find(l => l.id === lessonId);
        currentExerciseIndex = 0;

        showLessonView();
    }

    /**
     * Displays the current exercise.
     */
    function displayCurrentExercise() {
        feedback.innerHTML = '';
        feedback.className = '';
        checkAnswerBtn.textContent = 'Check';
        checkAnswerBtn.disabled = true;

        const exercise = currentLesson.exercises[currentExerciseIndex];
        questionContainer.innerHTML = '';

        if (exercise.type === 'multiple-choice') {
            const questionEl = document.createElement('p');
            questionEl.textContent = exercise.question;
            questionContainer.appendChild(questionEl);
            const optionsContainer = document.createElement('div');
            optionsContainer.classList.add('options');
            exercise.options.forEach(optionText => {
                const optionEl = document.createElement('button');
                optionEl.textContent = optionText;
                optionEl.classList.add('option');
                optionsContainer.appendChild(optionEl);
            });
            questionContainer.appendChild(optionsContainer);
        } else if (exercise.type === 'fill-in-the-blank') {
            const questionEl = document.createElement('p');
            questionEl.innerHTML = exercise.question.replace('___', '<input type="text" id="blank-input" placeholder="Type your answer">');
            questionContainer.appendChild(questionEl);
            checkAnswerBtn.disabled = false;
        } else {
            questionContainer.innerHTML = `<p>Unsupported question type: ${exercise.type}</p>`;
        }
    }

    /**
     * Checks the user's answer and provides feedback.
     */
    function checkAnswer() {
        const exercise = currentLesson.exercises[currentExerciseIndex];
        let isCorrect = false;

        if (exercise.type === 'multiple-choice') {
            const selectedOption = questionContainer.querySelector('.option.selected');
            if (!selectedOption) return;
            isCorrect = selectedOption.textContent === exercise.answer;
        } else if (exercise.type === 'fill-in-the-blank') {
            const input = document.getElementById('blank-input');
            isCorrect = input.value.trim().toLowerCase() === exercise.answer.toLowerCase();
        }

        // Only track performance for regular lessons, not practice sessions
        if (currentLesson.id !== 'practice-session') {
            updateExercisePerformance(exercise.id, isCorrect);
        }

        if (isCorrect) {
            feedback.textContent = "Correct! Well done.";
            feedback.className = 'correct';
            updateScore(10);
        } else {
            feedback.textContent = `Not quite. The correct answer is: ${exercise.answer}`;
            feedback.className = 'incorrect';
            updateLives(-1);
        }

        questionContainer.querySelectorAll('.option, #blank-input').forEach(el => el.disabled = true);
        checkAnswerBtn.textContent = 'Continue';
    }

    /**
     * Moves to the next exercise or completes the lesson.
     */
    function continueToNext() {
        currentExerciseIndex++;
        if (currentExerciseIndex < currentLesson.exercises.length) {
            displayCurrentExercise();
        } else {
            // If it was a practice session, just go back to the map
            if (currentLesson.id === 'practice-session') {
                lessonContainer.innerHTML = `<h2>Practice Complete!</h2><p>Great job reviewing!</p><button id="back-to-map">Back to Skill Map</button>`;
                saveProgress(); // Save progress after practice too
                return;
            }

            lessonContainer.innerHTML = `<h2>Lesson Complete!</h2><p>You finished "${currentLesson.title}"!</p><button id="back-to-map">Back to Skill Map</button>`;

            if (!userProgress.completedLessons.includes(currentLesson.id)) {
                userProgress.completedLessons.push(currentLesson.id);
            }

            const currentSkillLessons = currentSkill.lessons.map(l => l.id);
            const allLessonsOfSkillCompleted = currentSkillLessons.every(lId => userProgress.completedLessons.includes(lId));
            if (allLessonsOfSkillCompleted) {
                const currentSkillIndex = lessonsData.skills.findIndex(s => s.id === currentSkill.id);
                const nextSkill = lessonsData.skills[currentSkillIndex + 1];
                if (nextSkill && !userProgress.unlockedSkills.includes(nextSkill.id)) {
                    userProgress.unlockedSkills.push(nextSkill.id);
                }
            }
            saveProgress();
        }
    }

    /**
     * Updates score and UI.
     */
    function updateScore(points) {
        score += points;
        scoreEl.textContent = `Score: ${score}`;
    }

    /**
     * Updates lives and UI, handling game over.
     */
    function updateLives(change) {
        lives += change;
        livesEl.textContent = `Lives: ${lives}`;
        if (lives <= 0) {
            lessonContainer.innerHTML = `<h2>Game Over</h2><p>You've run out of lives!</p><button id="restart-lesson">Try Again</button><button id="back-to-map-gameover">Skill Map</button>`;
        }
    }

    // --- Spaced Repetition & Progress Management ---

    /**
     * Updates the performance data for a given exercise.
     * @param {string} exerciseId The ID of the exercise.
     * @param {boolean} isCorrect Whether the user answered correctly.
     */
    function updateExercisePerformance(exerciseId, isCorrect) {
        if (!userProgress.exercisePerformance[exerciseId]) {
            userProgress.exercisePerformance[exerciseId] = { score: 0 };
        }
        const performance = userProgress.exercisePerformance[exerciseId];
        // A simple scoring system: +1 for correct, -2 for incorrect to weigh wrong answers more.
        performance.score += isCorrect ? 1 : -2;
    }

    /**
     * Generates and starts a practice lesson with the user's weakest exercises.
     */
    function startPracticeSession() {
        const performanceData = userProgress.exercisePerformance;
        const allExercises = lessonsData.skills.flatMap(s => s.lessons.flatMap(l => l.exercises));

        const weakExercises = Object.entries(performanceData)
            .filter(([, data]) => data.score < 1) // Any score less than 1 is considered weak
            .sort((a, b) => a[1].score - b[1].score) // Sort by lowest score first
            .map(([id]) => allExercises.find(ex => ex.id === id))
            .filter(Boolean); // Filter out any not found exercises

        if (weakExercises.length === 0) {
            console.log("No weak exercises to practice!");
            return;
        }

        currentLesson = {
            id: 'practice-session',
            title: 'Practice Session',
            exercises: weakExercises.slice(0, 5) // Take up to 5 weakest exercises
        };
        // This is a "dummy" skill for the context of the lesson
        currentSkill = { id: 'practice', title: 'Practice', lessons: [currentLesson] };
        currentExerciseIndex = 0;

        showLessonView();
    }

    /**
     * Checks if the practice button should be enabled.
     */
    function updatePracticeButton() {
        const weakExercisesCount = Object.values(userProgress.exercisePerformance).filter(p => p.score < 1).length;
        // Enable practice if there are at least 3 weak concepts
        practiceBtn.disabled = weakExercisesCount < 3;
    }

    function saveProgress() {
        localStorage.setItem('hardwareGameProgress', JSON.stringify(userProgress));
        updatePracticeButton(); // Also update button state on every save
    }

    function loadProgress() {
        const savedProgress = localStorage.getItem('hardwareGameProgress');
        if (savedProgress) {
            const loaded = JSON.parse(savedProgress);
            // Simple migration if old data without exercisePerformance is loaded
            if (!loaded.exercisePerformance) {
                loaded.exercisePerformance = {};
            }
            userProgress = loaded;
        }
    }

    // --- Event Listeners ---
    skillMap.addEventListener('click', (e) => {
        if (e.target.classList.contains('skill-node') && e.target.classList.contains('unlocked')) {
            const skillId = e.target.dataset.skillId;
            const skill = lessonsData.skills.find(s => s.id === skillId);
            const firstUncompletedLesson = skill.lessons.find(l => !userProgress.completedLessons.includes(l.id));

            if (firstUncompletedLesson) {
                startLesson(skillId, firstUncompletedLesson.id);
            } else if (skill.lessons.length > 0) {
                // If all are completed, just start the first one again
                startLesson(skillId, skill.lessons[0].id);
            }
        }
    });

    questionContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('option')) {
            questionContainer.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
            checkAnswerBtn.disabled = false;
        }
    });

    checkAnswerBtn.addEventListener('click', () => {
        if (checkAnswerBtn.textContent === 'Check') {
            checkAnswer();
        } else {
            continueToNext();
        }
    });

    practiceBtn.addEventListener('click', () => {
        if (!practiceBtn.disabled) {
            startPracticeSession();
        }
    });

    // Event listener for dynamically created buttons
    document.body.addEventListener('click', e => {
        if (e.target.id === 'back-to-map' || e.target.id === 'back-to-map-gameover') {
            showSkillMap();
        }
        if (e.target.id === 'restart-lesson') {
            // Reset lives and restart the same lesson
            lives = 5;
            updateLives(0);
            startLesson(currentSkill.id, currentLesson.id);
        }
    });

    // --- Initialize ---
    initializeGame();
});