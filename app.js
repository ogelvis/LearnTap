(function () {
  "use strict";

  const courseContent = window.COURSE_DATA;
  const courses = window.LEARNTAP_COURSES;
  const storageKey = "learntap-platform-v1";
  const oldProgressKey = "novini-digital-marketing-progress-v1";
  const videoStatuses = ["not-required", "pending", "generating", "ready", "failed", "fallback-active", "regenerating"];
  const maxVideoAttempts = 2;
  const levelNames = ["Basic", "Intermediate", "Advanced"];
  const levelThemes = ["basic", "intermediate", "advanced"];
  const demoModuleNames = [
    ["Start with the essentials", "Put the basics into practice", "Make your first project"],
    ["Connect the ideas", "Work through a real scenario", "Build a stronger approach"],
    ["Plan a complete solution", "Make informed decisions", "Present your finished project"]
  ];
  const introSlides = [
    ["WELCOME", "Welcome to LearnTap"],
    ["WHAT THIS PLACE IS FOR", "A practical space to learn skills you can use."],
    ["FIND YOUR DIRECTION", "Explore creative, technical and business learning paths."],
    ["BUILD STEP BY STEP", "Follow a clear path from the foundations to deeper skills."],
    ["LEARN BY DOING", "Practice with activities, examples and projects."],
    ["SEE YOUR PROGRESS", "Pick up where you left off and know what comes next."],
    ["YOUR NEXT CHAPTER", "Learn practical skills. Grow with confidence."]
  ];
  let state;
  let currentCourse = null;
  let currentLevel = null;
  let currentLesson = null;
  let videoTimer = null;
  let videoSceneIndex = 0;
  let videoPlaying = false;
  let introTimer = null;
  let introIndex = 0;
  let introPlaying = false;
  let activeIntroSlides = introSlides;
  let quizChoice = null;
  let activeFilterCategory = "";
  let instructorCourseId = "";
  let instructorLessonId = "";
  const teachingStatuses = ["Lesson Planned", "Lesson Ongoing", "Lesson Taught", "Lesson Reviewed", "Lesson Completed"];
  const understandingRatings = ["Needs review", "Developing", "Understood", "Confident"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = () => window.location.hash.replace(/^#\/?/, "") || "home";
  const percent = (done, total) => total ? Math.round(done / total * 100) : 0;
  const courseById = id => courses.find(course => course.id === id);
  const videoKey = (weekIndex, classIndex) => `${weekIndex}-${classIndex}`;
  state = { lessonEdits: {}, moduleEdits: {}, moduleLevels: {}, lessonOrders: {} };
  state = loadState();

  function loadState() {
    const base = { enrolled: [], completed: {}, videoStates: {}, currentCourse: "", currentLessonId: "", visitedLessons: [], recent: [], projects: {}, lessonEdits: {}, teacherNotes: {}, teachingStatus: {}, moduleEdits: {}, moduleLevels: {}, lessonOrders: {}, finalProjectEdits: {}, courseEdits: {}, customCourses: [], studentWork: {}, studentUnderstanding: {} };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved === "object") {
        base.completed = {};
        base.currentCourse = typeof saved.currentCourse === "string" ? saved.currentCourse : "";
        base.currentLessonId = typeof saved.currentLessonId === "string" ? saved.currentLessonId : "";
        base.visitedLessons = Array.isArray(saved.visitedLessons) ? saved.visitedLessons.filter(id => typeof id === "string") : [];
        base.recent = Array.isArray(saved.recent) ? saved.recent.filter(id => courseById(id)).slice(0, 8) : [];
        base.projects = saved.projects && typeof saved.projects === "object" ? saved.projects : {};
        base.lessonEdits = saved.lessonEdits && typeof saved.lessonEdits === "object" ? saved.lessonEdits : {};
        base.teacherNotes = saved.teacherNotes && typeof saved.teacherNotes === "object" ? saved.teacherNotes : {};
        base.teachingStatus = saved.teachingStatus && typeof saved.teachingStatus === "object" ? saved.teachingStatus : {};
        base.moduleEdits = saved.moduleEdits && typeof saved.moduleEdits === "object" ? saved.moduleEdits : {};
        base.moduleLevels = saved.moduleLevels && typeof saved.moduleLevels === "object" ? saved.moduleLevels : {};
        base.lessonOrders = saved.lessonOrders && typeof saved.lessonOrders === "object" ? saved.lessonOrders : {};
        base.finalProjectEdits = saved.finalProjectEdits && typeof saved.finalProjectEdits === "object" ? saved.finalProjectEdits : {};
        base.studentWork = saved.studentWork && typeof saved.studentWork === "object" ? saved.studentWork : {};
        base.studentUnderstanding = saved.studentUnderstanding && typeof saved.studentUnderstanding === "object" ? saved.studentUnderstanding : {};
        base.courseEdits = saved.courseEdits && typeof saved.courseEdits === "object" ? saved.courseEdits : {};
        base.customCourses = Array.isArray(saved.customCourses) ? saved.customCourses.filter(course => course && typeof course.id === "string" && typeof course.title === "string") : [];
        base.customCourses.forEach(course => {
          if (!courseById(course.id)) courses.push(course);
        });
        base.enrolled = Array.isArray(saved.enrolled) ? saved.enrolled.filter(id => courseById(id)) : [];
        base.recent = Array.isArray(saved.recent) ? saved.recent.filter(id => courseById(id)).slice(0, 8) : [];
        Object.entries(saved.completed && typeof saved.completed === "object" ? saved.completed : {}).forEach(([courseId, completed]) => {
          const course = courseById(courseId);
          if (!course || !Array.isArray(completed)) return;
          const lessons = allLessons(course);
          const validIds = new Set(lessons.map(lesson => lesson.id));
          const mapped = completed.map(id => {
            if (validIds.has(id)) return id;
            if (courseId !== "digital-marketing" || typeof id !== "string") return null;
            const match = id.match(/^digital-marketing:basic:(\d+):(\d+)$/);
            if (!match) {
              const legacyLevel = id.match(/^digital-marketing:(intermediate|advanced):(\d+):(\d+)$/);
              if (!legacyLevel) return null;
              const targetLevel = allLessons(course).filter(lesson => lesson.levelIndex === (legacyLevel[1] === "intermediate" ? 1 : 2));
              const oldPosition = Number(legacyLevel[2]) * 2 + Number(legacyLevel[3]);
              return targetLevel[oldPosition]?.id || null;
            }
            const week = courseContent.weeks[Number(match[1])];
            const legacyTitle = week?.classes[Number(match[2])]?.[0];
            if (!legacyTitle) return null;
            const aliases = { "Traditional Marketing vs Digital Marketing": "Traditional vs Digital Marketing" };
            const desiredTitle = aliases[legacyTitle] || legacyTitle;
            return lessons.find(lesson => lesson.title.toLowerCase() === desiredTitle.toLowerCase())?.id || null;
          }).filter(Boolean);
          base.completed[courseId] = Array.from(new Set(mapped));
        });
        Object.entries(base.courseEdits).forEach(([id, edits]) => {
          const course = courseById(id);
          if (!course || !edits || typeof edits !== "object") return;
          if (typeof edits.title === "string") course.title = edits.title;
          if (typeof edits.description === "string") course.description = edits.description;
        });
        Object.entries(saved.videoStates || {}).forEach(([key, value]) => {
          if (value && videoStatuses.includes(value.status)) {
            base.videoStates[key] = { status: value.status, attempts: Number.isInteger(value.attempts) ? Math.min(maxVideoAttempts, Math.max(0, value.attempts)) : 0 };
          }
        });
        return base;
      }
      const old = JSON.parse(localStorage.getItem(oldProgressKey) || "null");
      const digitalMarketing = courseById("digital-marketing");
      if (old && Array.isArray(old.completed) && old.completed.length && digitalMarketing) {
        const legacyTitles = courseContent.weeks.flatMap(week => week.classes.map(record => record[0]));
        const lessons = allLessons(digitalMarketing);
        base.enrolled.push(digitalMarketing.id);
        old.completed.forEach(index => {
          if (!Number.isInteger(index) || !legacyTitles[index]) return;
          const aliases = { "Traditional Marketing vs Digital Marketing": "Traditional vs Digital Marketing" };
          const title = aliases[legacyTitles[index]] || legacyTitles[index];
          const lesson = lessons.find(item => item.title.toLowerCase() === title.toLowerCase());
          if (lesson) base.completed[digitalMarketing.id] = [...(base.completed[digitalMarketing.id] || []), lesson.id];
        });
        Object.entries(old.videoStates || {}).forEach(([key, value]) => {
          if (value && videoStatuses.includes(value.status)) base.videoStates[`digital-marketing:${key}`] = value;
        });
      }
      return base;
    } catch (error) {
      console.error("Could not load LearnTap browser progress.", error);
      return base;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error("Could not save LearnTap browser progress.", error);
      alert("Your progress could not be saved in this browser. Check your browser storage settings.");
    }
  }

  function definitionFor(course, title) {
    const topic = title.replace(/^(what is|understanding|introduction to|creating|building|using|project:)\s*/i, "").replace(/\s*\([^)]*\)/g, "").trim();
    const definitions = {
      "digital marketing": "Digital marketing is the use of digital channels and connected devices to communicate an offer and reach customers.",
      "marketing": "Marketing is the work of understanding customers and communicating the value of a product or service.",
      "social media": "Social media are online platforms where people and organisations create, share and interact with content.",
      "social media marketing": "Social media marketing uses social platforms to communicate with an audience and support a business goal.",
      "content": "Content is information or creative material made to inform, entertain or help a particular audience.",
      "target audience": "A target audience is the specific group of people a business or message is intended to reach.",
      "customer persona": "A customer persona is a research-informed description of a typical person in a target audience.",
      "branding": "Branding is the set of choices and experiences that help people recognise and understand a business.",
      "html": "HTML (HyperText Markup Language) is the markup language used to structure content on web pages.",
      "css": "CSS (Cascading Style Sheets) is the language used to control the presentation and layout of web content.",
      "javascript": "JavaScript is a programming language commonly used to add behaviour and interactivity to web pages.",
      "coding": "Coding is writing instructions in a programming language so a computer can perform a task.",
      "computer": "A computer is an electronic device that accepts, processes and stores information according to instructions.",
      "computer hardware": "Computer hardware is the physical equipment and components that make up a computer system.",
      "computer software": "Computer software is the set of programs and instructions that tell computer hardware what to do.",
      "operating system": "An operating system is the core software that manages a computer's hardware, files and applications.",
      "internet": "The internet is a global network of connected computer networks that exchange information.",
      "graphic design": "Graphic design is the practice of arranging text and visual elements to communicate a message clearly.",
      "coreldraw": "CorelDRAW is a vector-graphics design application used to create and edit visual artwork.",
      "cyber security": "Cyber security is the practice of protecting devices, accounts, networks and information from digital threats.",
      "cloud computing": "Cloud computing provides computing services such as storage and servers over a network when needed.",
      "server": "A server is a computer or program that provides data or services to other computers over a network.",
      "public cloud": "A public cloud provides computing services over the internet using infrastructure shared among customers.",
      "private cloud": "A private cloud is cloud infrastructure dedicated to one organisation.",
      "hybrid cloud": "A hybrid cloud combines private infrastructure with public cloud services.",
      "search engine optimisation": "Search engine optimisation (SEO) is the practice of improving useful web content so people can find it through relevant search results.",
      "iaas": "Infrastructure as a Service (IaaS) provides virtual computing infrastructure such as servers, storage and networking; the customer manages the operating system and applications.",
      "paas": "Platform as a Service (PaaS) provides a managed environment for building and running applications without managing the underlying servers.",
      "saas": "Software as a Service (SaaS) is software accessed over a network where the provider manages the application and its infrastructure.",
      "typography": "Typography is the selection and arrangement of type to make text readable and communicate its importance.",
      "visual hierarchy": "Visual hierarchy is the arrangement of elements that guides a viewer to notice information in order of importance.",
      "phishing": "Phishing is a deceptive message or website designed to trick someone into sharing information or taking an unsafe action.",
      "malware": "Malware is software created to damage a device, disrupt its operation or access information without permission.",
      "multi-factor authentication": "Multi-factor authentication requires more than one kind of proof to verify a user's identity.",
      "password manager": "A password manager is a tool that securely stores and helps create unique passwords for accounts.",
      "web browser": "A web browser is an application that retrieves and displays websites and other web content.",
      "search engine": "A search engine helps people find relevant information by searching an indexed collection of web pages.",
      "file management": "File management is the practice of naming, organising, storing and retrieving digital files.",
      "public wi-fi": "Public Wi-Fi is wireless internet access shared in a public place; users should treat it as an untrusted network."
    };
    const match = Object.entries(definitions).sort(([first], [second]) => second.length - first.length).find(([key]) => topic.toLowerCase().includes(key));
    return match ? match[1] : `${topic} is a ${course.title.toLowerCase()} concept, method or tool used to support a practical learning goal.`;
  }

  function makeStoryboard(lesson) {
    const title = lesson.title;
    const technicalCloudTopic = /^(Traditional vs Cloud Computing|Cloud Storage|What is a Server\?|Virtualisation|Comparing Cloud Service Models|Public Cloud|Hybrid Cloud|Hosting a Website)$/i.test(title);
    const visualTopic = technicalCloudTopic || /\b(workflow|process|tool|interface|html|css|javascript|dom|forms?|file management|install(?:ing)?|downloads?|uploads?|layout|flexbox|grid|campaign|journey|strategy|phishing|passwords?|authentication|design|posters?|flyers?|logos?|platforms?|compare|vs|channels?|content planning|schedule|hosting|backup|responsive|website|browser|search engine)\b/i.test(title);
    const totalDuration = visualTopic;
    if (!totalDuration) return null;
    const seconds = /project|final|campaign|complete|responsive|strategy/i.test(lesson.title) ? 60 : 45;
    const topic = lesson.title.replace(/^(what is|understanding|introduction to)\s*/i, "").trim();
    const beats = [
      { purpose: "Introduce the topic", visual: `Show the goal behind ${topic.toLowerCase()}`, narration: lesson.objective, text: topic },
      { purpose: "Define the concept", visual: "Place the key idea in a clear labelled diagram", narration: lesson.definition, text: lesson.definition },
      { purpose: "Explain the process", visual: "Animate a simple sequence from input to outcome", narration: lesson.explanation, text: "Understand → Apply → Review" },
      { purpose: "Show an example", visual: "Use a familiar local or everyday scenario", narration: lesson.example, text: "A real-world example" },
      { purpose: "Demonstrate a practical step", visual: "Highlight each choice in a short worked example", narration: lesson.demonstration, text: "Try the steps" },
      { purpose: "End with a takeaway", visual: "Bring the main idea and result together", narration: lesson.keyPoints.join(". "), text: "One concept. One useful next step." }
    ];
    const durationPerScene = seconds / beats.length;
    const storyboard = beats.map((beat, index) => ({
      number: index + 1,
      purpose: beat.purpose,
      visualDescription: beat.visual,
      narration: beat.narration,
      onScreenText: beat.text,
      animationDirection: index === 0 ? "Fade in the topic and reveal one labelled element at a time." : "Use a restrained highlight, arrow or step transition to match the explanation.",
      duration: Math.round(durationPerScene)
    }));
    return {
      duration: seconds,
      summary: `A short visual explanation of ${topic.toLowerCase()}.`,
      storyboard,
      scenes: storyboard.map(scene => ({
        label: scene.purpose,
        diagram: [topic.toUpperCase(), scene.number < 6 ? `STEP ${scene.number}` : "KEY TAKEAWAY"],
        caption: scene.narration
      }))
    };
  }

  function makeCurriculumLesson(course, levelIndex, moduleIndex, lessonIndex, sourceModuleIndex, moduleTitle, title) {
    const topic = title.replace(/^(what is|understanding|introduction to)\s*/i, "").trim();
    const skill = course.skills[(sourceModuleIndex + lessonIndex + levelIndex) % course.skills.length];
    const example = course.id.includes("marketing")
      ? `A small business in Port Harcourt could use ${topic.toLowerCase()} to share a helpful offer with local customers.`
      : course.id === "computer-fundamentals"
        ? `A student preparing a school presentation could use ${topic.toLowerCase()} to organise and present their work.`
        : course.id.includes("security")
          ? `A student receives an unexpected message asking them to open a link; applying ${topic.toLowerCase()} helps them pause and choose a safer response.`
          : `A learner creating a small ${course.title.toLowerCase()} project can apply ${topic.toLowerCase()} to make the result clearer and more useful.`;
    const practical = /project|creating|build|practice|plan|present|tool|using|design|develop|test|style|write|manage|analyse/i.test(title);
    const researchUseful = /\b(platform|provider|security|privacy|cloud|career|audience|customer|marketing|design|accessibility|performance|internet|search|public|private|hybrid|project|campaign|content|business|scam|phishing|website|channel|brand|research|community)\b/i.test(`${title} ${moduleTitle}`);
    const lesson = {
      id: `${course.id}:lesson:${sourceModuleIndex}:${lessonIndex}`,
      courseId: course.id, levelIndex, moduleIndex, lessonIndex, moduleTitle, title,
      definition: definitionFor(course, title),
      summary: `${topic} is explored through a clear explanation, a familiar example and a practical step in ${course.title}.`,
      objective: skill,
      explanation: `${topic} matters because it helps learners ${skill.toLowerCase()}. Start by identifying the goal, then notice how the idea or tool supports that goal. Use a small example before applying it to a larger task.`,
      keyPoints: [skill, `Connect ${topic.toLowerCase()} to a clear goal`, "Practise with a small, relevant example"],
      example,
      demonstration: `Walk through a simple ${topic.toLowerCase()} example. Identify the goal, show each important choice, then explain how to check the result.`,
      activity: `Practise ${topic.toLowerCase()} using the example above. Record the steps you took and one change that would improve the result.`,
      question: `In your own words, what does ${topic.toLowerCase()} mean in this lesson?`,
      options: [`Explain the idea and connect it to ${course.title.toLowerCase()}`, "Memorise a term without understanding it", "Skip the goal and choose a random tool"],
      answer: 0,
      studentQuestions: [
        `Explain ${topic.toLowerCase()} in your own words.`,
        `Why is ${topic.toLowerCase()} useful when working on ${course.title.toLowerCase()}?`,
        `Which part of the example shows ${topic.toLowerCase()} in practice?`,
        `How would you apply ${topic.toLowerCase()} to a different situation?`
      ],
      takeHomeQuestions: practical ? [
        `What did you make or practise for "${title}"?`,
        `Why did you choose that approach?`,
        `Which idea from "${title}" did you apply?`,
        `What problem did you encounter, and how did you respond?`,
        `What would you improve next, and what could you research to guide that improvement?`
      ] : [
        `What is ${topic.toLowerCase()}? Define it in your own words.`,
        `Explain how ${topic.toLowerCase()} works or why it matters.`,
        `Give a real-world example of ${topic.toLowerCase()}.`,
        `How could you apply ${topic.toLowerCase()} to a practical task?`,
        `Research one relevant example and explain what you learned.`
      ],
      assignment: `Create a short, labelled example that demonstrates ${topic.toLowerCase()}. Explain one decision you made and how the example supports the goal.`,
      research: researchUseful ? `Research one real example of ${topic.toLowerCase()} used by a Nigerian organisation, school or small business. Describe what you observed and connect it to this lesson.` : "",
      project: `Add one useful piece of work related to ${topic.toLowerCase()} to your ${course.title} course project.`,
      instructorQuestions: [
        `Can you explain "${topic}" in your own words?`,
        `Which part of the example demonstrates ${topic.toLowerCase()}?`,
        `How would you adapt this idea to a different real situation?`
      ],
      expectedUnderstanding: `The learner can describe ${topic.toLowerCase()}, connect it to the stated goal, and apply it to a relevant example.`,
      video: null, videoId: null
    };
    const edits = state.lessonEdits[lesson.id];
    if (edits) Object.assign(lesson, edits);
    lesson.id = `${course.id}:lesson:${sourceModuleIndex}:${lessonIndex}`;
    lesson.courseId = course.id;
    lesson.levelIndex = levelIndex;
    lesson.moduleIndex = moduleIndex;
    lesson.lessonIndex = lessonIndex;
    lesson.moduleTitle = moduleTitle;
    if (course.id === "digital-marketing") {
      const legacyAliases = {
        "Traditional vs Digital Marketing": "Traditional Marketing vs Digital Marketing",
        "Creating a Customer Persona": "Creating a Simple Customer Profile",
        "Building a Brand Identity": "Brand Identity, Name and Logo",
        "Creating a Social Media Presence": "Building a Business Social Media Presence",
        "Search Engine Optimisation (SEO)": "Basic SEO and Search Engines",
        "Planning a Campaign": "Planning a Digital Marketing Campaign",
        "Measuring Marketing Results": "Measuring Simple Marketing Results"
      };
      const legacyTitle = legacyAliases[title] || title;
      const legacyRecord = courseContent.weeks.flatMap(week => week.classes).find(record => record[0].toLowerCase() === legacyTitle.toLowerCase());
      if (legacyRecord) {
        lesson.summary = legacyRecord[1];
        lesson.explanation = legacyRecord[1];
        lesson.example = legacyRecord[2];
        lesson.activity = legacyRecord[4];
        lesson.question = legacyRecord[5];
        lesson.options = legacyRecord[6];
        lesson.answer = legacyRecord[7];
        lesson.keyPoints = legacyRecord[8];
      }
    }
    const videoKeyForLesson = {
      "What is Digital Marketing?": "0-1",
      "What is a Target Audience?": "1-1",
      "Creating a Customer Persona": "1-5",
      "Building a Brand Identity": "2-1",
      "Digital Marketing Channels": "3-0",
      "Search Engine Optimisation (SEO)": "3-3"
    }[title];
    if (course.id === "digital-marketing" && videoKeyForLesson && courseContent.microVideos[videoKeyForLesson]) {
      lesson.video = courseContent.microVideos[videoKeyForLesson];
      lesson.videoId = `${course.id}:${videoKeyForLesson}`;
    }
    if (!lesson.video) {
      lesson.video = makeStoryboard(lesson);
      if (lesson.video) lesson.videoId = `${course.id}:generated:${sourceModuleIndex}:${lessonIndex}`;
    }
    if (lesson.video && Array.isArray(lesson.storyboard)) {
      lesson.video.scenes = lesson.storyboard.map(scene => ({
        label: scene.purpose,
        diagram: [scene.onScreenText, scene.visualDescription].filter(Boolean),
        caption: scene.narration
      }));
      lesson.video.duration = lesson.storyboard.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0) || lesson.video.duration;
    }
    lesson.studentQuestions = Array.isArray(lesson.studentQuestions) ? lesson.studentQuestions : [];
    lesson.takeHomeQuestions = Array.isArray(lesson.takeHomeQuestions) ? lesson.takeHomeQuestions.slice(0, 5) : [];
    while (lesson.takeHomeQuestions.length < 5) lesson.takeHomeQuestions.push([
      `Define ${topic.toLowerCase()} in your own words.`,
      `Explain why ${topic.toLowerCase()} matters.`,
      `Give an example of ${topic.toLowerCase()}.`,
      `Apply ${topic.toLowerCase()} to a practical situation.`,
      `Research a relevant example of ${topic.toLowerCase()}.`
    ][lesson.takeHomeQuestions.length]);
    lesson.keyPoints = Array.isArray(lesson.keyPoints) ? lesson.keyPoints : [];
    return lesson;
  }

  function makeGenericLesson(course, levelIndex, moduleIndex, lessonIndex, title) {
    return makeCurriculumLesson(course, levelIndex, moduleIndex, lessonIndex, moduleIndex, demoModuleNames[levelIndex][moduleIndex], title);
  }

  function buildLevels(course) {
    const curriculum = (window.LEARNTAP_CURRICULA && window.LEARNTAP_CURRICULA[course.id]) || course.curriculum;
    if (Array.isArray(curriculum) && curriculum.length) {
      const levels = levelNames.map((name, index) => ({ id: levelThemes[index], name, modules: [] }));
      curriculum.forEach((module, sourceModuleIndex) => {
        const suggestedLevel = Math.min(2, Math.floor(sourceModuleIndex * 3 / curriculum.length));
        const storedLevel = Number(state.moduleLevels[`${course.id}:${sourceModuleIndex}`]);
        const levelIndex = Number.isInteger(storedLevel) && storedLevel >= 0 && storedLevel < 3 ? storedLevel : suggestedLevel;
        const moduleIndex = levels[levelIndex].modules.length;
        levels[levelIndex].modules.push({
          id: `${course.id}:${levelThemes[levelIndex]}:module:${moduleIndex}`,
          title: state.moduleEdits[`${course.id}:${sourceModuleIndex}`] || module.title,
          lessons: module.lessons.map((title, lessonIndex) => makeCurriculumLesson(course, levelIndex, moduleIndex, lessonIndex, sourceModuleIndex, module.title, title))
            .sort((a, b) => (Number(state.lessonOrders[a.id]) || a.lessonIndex + 1) - (Number(state.lessonOrders[b.id]) || b.lessonIndex + 1) || a.lessonIndex - b.lessonIndex)
            .map((lesson, lessonIndex) => ({ ...lesson, lessonIndex }))
        });
      });
      return levels;
    }
    const levels = levelNames.map((name, levelIndex) => {
      const moduleNames = demoModuleNames[levelIndex];
      const modules = moduleNames.map((moduleName, moduleIndex) => ({
        id: `${course.id}:${levelThemes[levelIndex]}:module:${moduleIndex}`,
        title: moduleName,
        lessons: [0, 1].map(lessonIndex => makeGenericLesson(
          course,
          levelIndex,
          moduleIndex,
          lessonIndex,
          [
            [`An introduction to ${course.title}`, `Key ideas in ${course.title}`, "A first practical exercise", "Learn from a worked example", "Plan a small piece of work", "Review and improve your result"],
            [`Build on the foundations`, `Make a thoughtful choice`, `Practice with a real scenario`, `Develop your approach`, `Plan a complete task`, `Review the result`],
            [`Set a clear direction`, `Bring the skills together`, `Work through a complex brief`, `Make and explain decisions`, `Prepare a final project`, `Present your work`]
          ][levelIndex][moduleIndex * 2 + lessonIndex]
        ))
      }));
      return { id: levelThemes[levelIndex], name, modules };
    });

    if (course.id === "digital-marketing") {
      levels[0].modules = courseContent.weeks.map((week, weekIndex) => ({
        id: `${course.id}:basic:module:${weekIndex}`,
        title: week.title,
        lessons: week.classes.map((record, classIndex) => ({
          id: `${course.id}:basic:${weekIndex}:${classIndex}`,
          courseId: course.id,
          levelIndex: 0,
          moduleIndex: weekIndex,
          lessonIndex: classIndex,
          title: record[0],
          summary: record[1],
          objective: record[8][0],
          keyPoints: record[8],
          example: record[2],
          discussion: record[3],
          activity: record[4],
          question: record[5],
          options: record[6],
          answer: record[7],
          video: courseContent.microVideos[videoKey(weekIndex, classIndex)] || null,
          videoId: courseContent.microVideos[videoKey(weekIndex, classIndex)] ? `${course.id}:${videoKey(weekIndex, classIndex)}` : null
        }))
      }));
      levels[1].modules = [
        { id: `${course.id}:intermediate:module:0`, title: "Plan a thoughtful campaign", lessons: ["Set a campaign goal", "Connect an audience, message and channel"].map((title, index) => makeGenericLesson(course, 1, 0, index, title)) },
        { id: `${course.id}:intermediate:module:1`, title: "Create and review content", lessons: ["Plan a small content series", "Use feedback to improve a message"].map((title, index) => makeGenericLesson(course, 1, 1, index, title)) }
      ];
      levels[2].modules = [
        { id: `${course.id}:advanced:module:0`, title: "Develop a complete marketing plan", lessons: ["Set priorities for a business", "Plan a connected channel mix"].map((title, index) => makeGenericLesson(course, 2, 0, index, title)) },
        { id: `${course.id}:advanced:module:1`, title: "Present and refine your strategy", lessons: ["Present a campaign proposal", "Review outcomes and recommend next steps"].map((title, index) => makeGenericLesson(course, 2, 1, index, title)) }
      ];
    }
    return levels;
  }

  function allLessons(course) {
    return buildLevels(course).flatMap(level => level.modules.flatMap(module => module.lessons));
  }

  function courseCompleted(course) {
    return state.completed[course.id] || [];
  }

  function courseProgress(course) {
    const lessons = allLessons(course);
    const done = courseCompleted(course).filter(id => lessons.some(lesson => lesson.id === id)).length;
    return percent(done, lessons.length);
  }

  function isEnrolled(course) {
    return state.enrolled.includes(course.id);
  }

  function levelProgress(course, levelIndex) {
    const level = buildLevels(course)[levelIndex];
    const lessons = level.modules.flatMap(module => module.lessons);
    const done = lessons.filter(lesson => courseCompleted(course).includes(lesson.id)).length;
    return { done, total: lessons.length, percent: percent(done, lessons.length) };
  }

  function firstIncompleteLesson(course, levelIndex = null) {
    const levels = buildLevels(course);
    const lessons = (levelIndex === null ? levels.flatMap(level => level.modules) : levels[levelIndex].modules).flatMap(module => module.lessons);
    return lessons.find(lesson => !courseCompleted(course).includes(lesson.id)) || lessons[lessons.length - 1];
  }

  function getVideoState(lesson) {
    if (!lesson || !lesson.videoId) return { status: "not-required", attempts: 0 };
    return state.videoStates[lesson.videoId] || { status: "ready", attempts: 0 };
  }

  function updateVideoState(lesson, next) {
    if (!lesson || !lesson.videoId) return;
    state.videoStates[lesson.videoId] = { ...getVideoState(lesson), ...next };
    saveState();
    const active = $("#learning-view-content");
    if (active && currentLesson && currentLesson.videoId === lesson.videoId) renderLesson();
  }

  function navigate(route) {
    if (route.startsWith("category/")) {
      activeFilterCategory = decodeURIComponent(route.slice("category/".length));
      route = "courses";
    } else if (route === "categories") {
      activeFilterCategory = "";
      route = "courses";
    } else activeFilterCategory = "";
    const parts = route.split("/");
    const name = parts[0] || "home";
    const pageName = name === "course" ? "course-detail" : name === "learn" ? "learning-view" : name;
    $$(".page").forEach(page => page.classList.toggle("active", page.dataset.page === pageName));
    const navName = name === "course" ? "courses" : name === "learn" ? "learning" : name;
    $$(".main-nav a").forEach(link => link.classList.toggle("active", link.dataset.route === navName));
    $("#main-nav").classList.remove("open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    if (name === "home") renderHome();
    if (name === "courses") renderLibrary();
    if (pageName === "course-detail") renderCourseDetail(parts[1]);
    if (name === "learning") renderDashboard();
    if (name === "instructor") renderInstructor();
    if (pageName === "learning-view") renderLessonRoute(parts);
    const title = name === "course" ? courseById(parts[1])?.title : name === "learn" ? `${currentLesson?.title || "Lesson"} · LearnTap` : null;
    document.title = title ? `${title.replace(" · LearnTap", "")} — LearnTap` : `${name === "home" ? "Learn practical skills" : name === "courses" ? "Explore courses" : name === "learning" ? "My learning" : name === "instructor" ? "Instructor workspace" : "LearnTap"} · LearnTap`;
    if (name !== "learn") stopVideo();
    if (!route.startsWith("learn/")) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function routeTo(route) {
    if (hash() === route) navigate(route);
    else window.location.hash = route;
  }

  function categories() {
    return Array.from(new Set(courses.map(course => course.category))).sort((a, b) => a.localeCompare(b));
  }

  function courseCard(course) {
    const enrolled = isEnrolled(course);
    const completion = courseProgress(course);
    return `<article class="course-card">
      <button class="course-art art-${slug(course.category)}" style="--art-color:${escapeHtml(course.color)}" data-route="course/${course.id}" aria-label="View ${escapeHtml(course.title)} course">
        <span class="art-top"><span>${escapeHtml(course.category)}</span><span class="art-sequence">${String(courses.indexOf(course) + 1).padStart(2, "0")}</span></span>
        <span class="art-monogram">${escapeHtml(course.icon)}</span>
        <span class="art-bottom">${escapeHtml(course.level)} <i></i> ${escapeHtml(course.duration)}</span>
      </button>
      <div class="course-card-info"><p class="course-category">${escapeHtml(course.category)}</p><h3><button data-route="course/${course.id}">${escapeHtml(course.title)}</button></h3><p class="course-description">${escapeHtml(course.description)}</p>
        <div class="course-card-meta"><span>${escapeHtml(course.level)}</span><span>${escapeHtml(course.duration)}</span></div>
        ${enrolled ? `<div class="mini-progress"><span style="width:${completion}%"></span></div><div class="course-card-bottom"><span>${completion}% complete</span><button class="text-button" data-route="course/${course.id}">Continue <span aria-hidden="true">→</span></button></div>` : `<div class="course-card-bottom"><span>${escapeHtml(course.students)}</span><button class="text-button" data-route="course/${course.id}">View course <span aria-hidden="true">→</span></button></div>`}
      </div>
    </article>`;
  }

  function renderHome() {
    const featured = courses.filter(course => course.featured).slice(0, 8);
    $("#featured-grid").innerHTML = featured.map(courseCard).join("");
    $("#home-categories").innerHTML = categories().map(category => `<button class="category-chip" data-route="category/${encodeURIComponent(category)}"><span>${escapeHtml(category)}</span><span aria-hidden="true">↗</span></button>`).join("");
  }

  function populateCategoryFilter() {
    const select = $("#category-filter");
    if (!select) return;
    const value = activeFilterCategory || select.value;
    select.innerHTML = `<option value="">All categories</option>${categories().map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
    select.value = categories().includes(value) ? value : "";
    activeFilterCategory = select.value;
  }

  function populateDurationFilter() {
    const select = $("#duration-filter");
    const selected = select.value;
    const durations = Array.from(new Set(courses.map(course => course.duration))).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    select.innerHTML = `<option value="">Any duration</option>${durations.map(duration => `<option value="${escapeHtml(duration)}">${escapeHtml(duration)}</option>`).join("")}`;
    select.value = durations.includes(selected) ? selected : "";
  }

  function populateInstructorFilter() {
    const select = $("#instructor-filter");
    if (!select) return;
    const selected = select.value;
    const instructors = Array.from(new Set(courses.map(course => course.instructor).filter(Boolean))).sort();
    select.innerHTML = `<option value="">All instructors</option>${instructors.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
    select.value = instructors.includes(selected) ? selected : "";
  }

  function renderLibrary() {
    populateCategoryFilter();
    populateDurationFilter();
    populateInstructorFilter();
    const search = ($("#course-search").value || "").trim().toLowerCase();
    const category = $("#category-filter").value;
    const level = $("#level-filter").value;
    const duration = $("#duration-filter").value;
    const learningType = $("#learning-type-filter").value;
    const instructor = $("#instructor-filter").value;
    const progressFilter = $("#progress-filter").value;
    const sort = $("#sort-filter").value;
    let matches = courses.filter(course => {
      const text = `${course.title} ${course.category} ${course.description} ${course.skills.join(" ")}`.toLowerCase();
      const progress = courseProgress(course);
      const progressMatch = !progressFilter || (progressFilter === "completed" && progress === 100) || (progressFilter === "in-progress" && progress > 0 && progress < 100) || (progressFilter === "not-started" && progress === 0);
      return (!search || text.includes(search)) && (!category || course.category === category) && (!level || course.level === level) && (!duration || course.duration === duration) && (!learningType || learningType === "Project-based" || course.learningType === learningType) && (!instructor || course.instructor === instructor) && progressMatch;
    });
    if (sort === "title") matches = matches.slice().sort((a, b) => a.title.localeCompare(b.title));
    else matches = matches.slice().sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title));
    $("#library-grid").innerHTML = matches.map(courseCard).join("");
    $("#course-count").textContent = `${matches.length} ${matches.length === 1 ? "course" : "courses"}${search || category || level || duration || learningType || instructor || progressFilter ? " found" : " to explore"}`;
    $("#empty-courses").hidden = matches.length > 0;
  }

  function renderCourseDetail(id) {
    const course = courseById(id);
    if (!course) {
      $("#course-detail-content").innerHTML = `<div class="not-found"><p class="eyebrow">COURSE NOT FOUND</p><h1>Let's find another path.</h1><button class="button button-dark" data-route="courses">Back to courses</button></div>`;
      return;
    }
    currentCourse = course;
    markRecent(course);
    const levels = buildLevels(course);
    const enrolled = isEnrolled(course);
    const progress = courseProgress(course);
    const nextLesson = enrolled ? firstIncompleteLesson(course) : levels[0].modules[0].lessons[0];
    const curriculum = levels.map((level, index) => {
      const stats = levelProgress(course, index);
      return `<section class="level-card level-${levelThemes[index]}">
        <div class="level-card-top"><div><span class="level-marker">LEVEL 0${index + 1}</span><h2>${escapeHtml(level.name)}</h2></div><span class="level-availability">${stats.percent === 100 ? "Completed" : "Available"}</span></div>
        <div class="level-progress-label"><span>${stats.done} of ${stats.total} lessons</span><strong>${stats.percent}%</strong></div><div class="progress-track"><span style="width:${stats.percent}%"></span></div>
        <div class="module-list">${level.modules.map((module, moduleIndex) => {
          const done = module.lessons.filter(lesson => courseCompleted(course).includes(lesson.id)).length;
          return `<article class="module-item"><div class="module-heading"><span>MODULE ${String(moduleIndex + 1).padStart(2, "0")}</span><strong>${escapeHtml(module.title)}</strong><small>${done}/${module.lessons.length} lessons</small></div>${module.lessons.map((lesson, lessonIndex) => {
            const completed = courseCompleted(course).includes(lesson.id);
            const visited = state.visitedLessons.includes(lesson.id);
            const inProgress = !completed && visited;
            const isCurrent = state.currentLessonId === lesson.id;
            return `<button class="curriculum-lesson ${completed ? "is-done" : inProgress ? "is-in-progress" : "is-available"}" data-route="learn/${course.id}/${level.id}/${moduleIndex}/${lessonIndex}"><span class="lesson-state">${completed ? "✓" : isCurrent ? "●" : "↗"}</span><span>${escapeHtml(lesson.title)}</span><small>${completed ? "Completed" : inProgress ? isCurrent ? "In Progress · Current" : "In Progress" : "Not Started"}</small></button>`;
          }).join("")}</article>`;
        }).join("")}</div>
      </section>`;
    }).join("");
    $("#course-detail-content").innerHTML = `
      <button class="back-link" data-route="courses">← All courses</button>
      <section class="course-hero">
        <div class="course-hero-copy"><p class="eyebrow">${escapeHtml(course.category)} <span class="tiny-separator">·</span> ${escapeHtml(course.level)}</p><h1>${escapeHtml(course.title)}</h1><p>${escapeHtml(course.description)}</p><div class="course-hero-tags"><span>${escapeHtml(course.duration)}</span><span>3 learning levels</span><span>${escapeHtml(course.instructor)}</span></div><div class="hero-actions">${enrolled ? `<button class="button button-dark" data-route="${lessonRoute(course, nextLesson)}">Continue learning <span aria-hidden="true">→</span></button>` : `<button class="button button-dark" data-enroll-course="${course.id}">Enroll in course <span aria-hidden="true">→</span></button>`}<button class="button button-quiet" data-action="course-intro" data-course-id="${course.id}">Watch course introduction <span aria-hidden="true">▶</span></button></div>${enrolled ? `<div class="detail-progress"><span>${progress}% complete</span><div class="progress-track"><span style="width:${progress}%"></span></div></div>` : ""}</div>
        <div class="course-hero-art" style="--art-color:${escapeHtml(course.color)}"><span>${escapeHtml(course.category.toUpperCase())}</span><strong>${escapeHtml(course.icon)}</strong><small>LEARN BY BUILDING</small></div>
      </section>
      <section class="course-overview-grid"><div><p class="eyebrow">ABOUT THIS COURSE</p><h2>A clear path from first steps to independent work.</h2><p>${escapeHtml(course.description)} Follow guided lessons, work through short activities and bring your learning together in a practical project.</p><div class="course-learning-outcomes"><h3>By the end, you can</h3><ul>${course.skills.map(skill => `<li>${escapeHtml(skill)}</li>`).join("")}</ul></div></div><aside class="course-fact-panel"><span>COURSE SNAPSHOT</span><div><small>Learning levels</small><strong>Basic · Intermediate · Advanced</strong></div><div><small>Estimated time</small><strong>${escapeHtml(course.duration)}</strong></div><div><small>Learning format</small><strong>Lessons · Practice · Projects</strong></div><div><small>Instructor</small><strong>${escapeHtml(course.instructor)}</strong></div></aside></section>
      <section class="course-introduction"><p class="eyebrow">COURSE INTRODUCTION</p><h2>Learn by understanding, practising and making.</h2><p><strong>What this course is:</strong> ${escapeHtml(course.description)}</p><p><strong>Why it matters:</strong> These skills help learners move from understanding the essentials to completing practical work they can explain.</p><p><strong>Who it is for:</strong> Learners who want a guided, hands-on introduction to ${escapeHtml(course.title)}.</p><p><strong>What you will learn:</strong> ${course.skills.map(escapeHtml).join(" · ")}</p><p><strong>Course structure:</strong> Basic, Intermediate and Advanced modules with definitions, explanations, examples, demonstrations, practice, questions and projects. Lessons stay open for flexible teaching.</p><p><strong>Final outcome:</strong> ${escapeHtml(state.finalProjectEdits[course.id] || window.LEARNTAP_FINAL_PROJECTS[course.id] || `A practical ${course.title} project.`)}</p></section>
      <section class="curriculum-section"><div class="section-heading"><div><p class="eyebrow">YOUR LEARNING PATH</p><h2>Build skills in stages.</h2><p>All lessons are available. Progress is tracked without locking course content.</p></div></div><div class="level-stack">${curriculum}</div></section>
      <section class="course-project-panel" id="course-project"><div><p class="eyebrow">PUT IT INTO PRACTICE</p><h2>Finish with work you can explain.</h2><p>${escapeHtml(state.finalProjectEdits[course.id] || window.LEARNTAP_FINAL_PROJECTS[course.id] || `Bring your ${course.title} skills together in a practical final project.`)}</p><ul class="course-project-checklist">${course.skills.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul><div class="project-progression"><span>1 · Guided exercise</span><span>2 · Mini project</span><span>3 · Integrated task</span><span>4 · Final project</span></div><p class="project-completion-note">${state.projects[course.id] ? "Project complete. A great milestone." : "Your final project is ready whenever you are."}</p><button class="button button-dark" data-action="complete-project" data-course-id="${course.id}">${state.projects[course.id] ? "Project completed ✓" : "Mark project complete"}</button></div><span class="project-index">PLAN <i>→</i> PRACTICE <i>→</i> PRESENT</span></section>`;
  }

  function markRecent(course) {
    state.currentCourse = course.id;
    state.recent = [course.id, ...state.recent.filter(id => id !== course.id)].slice(0, 8);
    saveState();
  }

  function renderDashboard() {
    const enrolled = state.enrolled.map(courseById).filter(Boolean);
    const done = enrolled.filter(course => courseProgress(course) === 100).length;
    const progressAverage = enrolled.length ? Math.round(enrolled.reduce((sum, course) => sum + courseProgress(course), 0) / enrolled.length) : 0;
    $("#dashboard-overview").innerHTML = `<article class="overview-tile overview-intro"><span class="eyebrow">YOUR LEARNING SPACE</span><h2>${enrolled.length ? "Good to have you back." : "A good place to begin."}</h2><p>${enrolled.length ? "Your learning is saved in this browser. Choose a course and keep building." : "Explore a skill, enroll in a demo course and your learning path will appear here."}</p></article><article class="overview-tile"><span class="eyebrow">COURSES</span><strong>${enrolled.length}</strong><small>in your learning space</small></article><article class="overview-tile"><span class="eyebrow">OVERALL PROGRESS</span><strong>${progressAverage}%</strong><div class="progress-track"><span style="width:${progressAverage}%"></span></div></article><article class="overview-tile"><span class="eyebrow">COMPLETED</span><strong>${done}</strong><small>${done === 1 ? "course finished" : "courses finished"}</small></article>`;
    $("#enrolled-grid").innerHTML = enrolled.length ? enrolled.map(courseCard).join("") : `<div class="empty-dashboard"><p class="eyebrow">YOUR NEXT CHAPTER</p><h3>Your courses will show up here.</h3><p>Pick a skill that interests you and start with the foundations.</p><button class="button button-dark" data-route="courses">Browse the course library <span aria-hidden="true">↗</span></button></div>`;
    const suggested = courses.filter(course => !isEnrolled(course)).slice(0, 4);
    $("#recommended-grid").innerHTML = suggested.map(courseCard).join("");
    const recent = state.recent.map(courseById).filter(Boolean).slice(0, 4);
    $("#recent-grid").innerHTML = recent.length ? recent.map(courseCard).join("") : `<div class="empty-dashboard"><p class="eyebrow">RECENT PATHS</p><h3>Courses you visit will appear here.</h3><p>Explore the library and your recent course pages will be easy to find.</p></div>`;
    const finished = enrolled.filter(course => courseProgress(course) === 100);
    $("#completed-grid").innerHTML = finished.length ? finished.map(courseCard).join("") : `<div class="empty-dashboard"><h3>Your completed courses will appear here.</h3><p>Finish a course to see it in this list.</p></div>`;
  }

  function renderInstructor() {
    if (!instructorCourseId || !courseById(instructorCourseId)) instructorCourseId = courses[0]?.id || "";
    const course = courseById(instructorCourseId);
    const courseSelect = $("#instructor-course-select");
    courseSelect.innerHTML = courses.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
    courseSelect.value = instructorCourseId;
    $("#instructor-course-list").innerHTML = courses.map(item => `<button class="instructor-course-link ${item.id === course.id ? "active" : ""}" data-instructor-course="${escapeHtml(item.id)}"><span>${escapeHtml(item.title)}</span><small>${courseProgress(item)}% progress</small></button>`).join("");
    if (!course) {
      $("#instructor-course-content").innerHTML = `<div class="empty-dashboard"><h3>Create your first course.</h3></div>`;
      return;
    }
    const lessons = allLessons(course);
    if (!lessons.some(lesson => lesson.id === instructorLessonId)) instructorLessonId = lessons[0]?.id || "";
    const lesson = lessons.find(item => item.id === instructorLessonId);
    const completeCount = lessons.filter(item => courseCompleted(course).includes(item.id)).length;
    const taughtCount = lessons.filter(item => ["Lesson Taught", "Lesson Reviewed", "Lesson Completed"].includes(state.teachingStatus[item.id])).length;
    const sourceCurriculum = window.LEARNTAP_CURRICULA[course.id] || course.curriculum || [];
    const courseTeacherNotes = state.teacherNotes[`course:${course.id}`] || {};
    const moduleFields = sourceCurriculum.map((module, index) => {
      const suggestedLevel = Math.min(2, Math.floor(index * 3 / sourceCurriculum.length));
      const selectedLevel = state.moduleLevels[`${course.id}:${index}`] ?? suggestedLevel;
      const currentTitle = state.moduleEdits[`${course.id}:${index}`] || module.title;
      return `<div class="instructor-module-editor"><label>Module ${index + 1}<input data-module-field="${index}" data-course-id="${escapeHtml(course.id)}" value="${escapeHtml(currentTitle)}"></label><label class="filter-field"><span>Learning level</span><select data-module-level="${index}" data-course-id="${escapeHtml(course.id)}">${levelNames.map((name, levelIndex) => `<option value="${levelIndex}" ${Number(selectedLevel) === levelIndex ? "selected" : ""}>${name}</option>`).join("")}</select></label><div>${module.lessons.map((item, lessonIndex) => `<label class="lesson-order-row"><span>${escapeHtml(item)}</span><input type="number" min="1" max="${module.lessons.length}" aria-label="Order for ${escapeHtml(item)}" data-lesson-order="${course.id}:lesson:${index}:${lessonIndex}" value="${Number(state.lessonOrders[`${course.id}:lesson:${index}:${lessonIndex}`]) || lessonIndex + 1}"></label>`).join("")}</div></div>`;
    }).join("");
    const options = buildLevels(course).flatMap(level => level.modules.flatMap(module => module.lessons.map(item =>
      `<option value="${escapeHtml(item.id)}" ${item.id === instructorLessonId ? "selected" : ""}>${escapeHtml(`${level.name} · ${module.title} · ${item.title}`)}</option>`
    ))).join("");
    if (!lesson) return;
    const privateNote = state.teacherNotes[lesson.id] || {};
    const studentWork = state.studentWork[lesson.id] || {};
    const understanding = state.studentUnderstanding[lesson.id] || "";
    const edited = state.lessonEdits[lesson.id] || {};
    const questions = Array.isArray(edited.studentQuestions) ? edited.studentQuestions : lesson.studentQuestions;
    const takeHome = Array.isArray(edited.takeHomeQuestions) ? edited.takeHomeQuestions.slice(0, 5) : lesson.takeHomeQuestions.slice(0, 5);
    const storyboardScenes = lesson.video?.storyboard || lesson.video?.scenes.map((scene, index) => ({
      number: index + 1, purpose: scene.label, visualDescription: scene.diagram.join(" → "),
      narration: scene.caption, onScreenText: scene.label, animationDirection: "Reveal the diagram elements in sequence.", duration: Math.round(lesson.video.duration / lesson.video.scenes.length)
    })) || [];
    const storyboardMarkup = lesson.video ? `<section class="instructor-storyboard"><p class="eyebrow">AUTOMATIC STORYBOARD · ${lesson.video.duration} SECONDS</p><h3>Visual explanation for this lesson</h3>${storyboardScenes.map((scene, index) => `<article><span>SCENE ${scene.number} · ${scene.duration}s</span><label class="instructor-edit-field">Purpose<input data-storyboard-field="purpose" data-lesson-id="${escapeHtml(lesson.id)}" data-scene-index="${index}" value="${escapeHtml(scene.purpose)}"></label><label class="instructor-edit-field">Visual description<textarea rows="2" data-storyboard-field="visualDescription" data-lesson-id="${escapeHtml(lesson.id)}" data-scene-index="${index}">${escapeHtml(scene.visualDescription)}</textarea></label><label class="instructor-edit-field">Narration<textarea rows="3" data-storyboard-field="narration" data-lesson-id="${escapeHtml(lesson.id)}" data-scene-index="${index}">${escapeHtml(scene.narration)}</textarea></label><label class="instructor-edit-field">On-screen text<input data-storyboard-field="onScreenText" data-lesson-id="${escapeHtml(lesson.id)}" data-scene-index="${index}" value="${escapeHtml(scene.onScreenText)}"></label><label class="instructor-edit-field">Animation direction<textarea rows="2" data-storyboard-field="animationDirection" data-lesson-id="${escapeHtml(lesson.id)}" data-scene-index="${index}">${escapeHtml(scene.animationDirection)}</textarea></label></article>`).join("")}</section>` : `<section class="instructor-storyboard"><p class="eyebrow">VIDEO DECISION</p><p>No video is currently suggested for this lesson. The lesson remains complete with text, examples, activities and research.</p></section>`;
    const fields = [
      ["title", "Lesson title", lesson.title],
      ["objective", "Teaching objective", lesson.objective],
      ["definition", "Definition", lesson.definition],
      ["explanation", "Simple explanation", lesson.explanation],
      ["example", "Clean / real-world example", lesson.example],
      ["demonstration", "Demonstration", lesson.demonstration],
      ["activity", "Practical activity", lesson.activity],
      ["project", "Mini project / practical task", lesson.project],
      ["assignment", "Take-home assignment", lesson.assignment],
      ["research", "Research task", lesson.research]
    ];
    const fieldMarkup = fields.map(([name, label, value]) => `<label class="instructor-edit-field">${escapeHtml(label)}<textarea rows="${name === "title" ? 1 : 3}" data-lesson-field="${name}" data-lesson-id="${escapeHtml(lesson.id)}">${escapeHtml(value || "")}</textarea></label>`).join("");
    const takeHomeFields = Array.from({ length: 5 }, (_, index) => `<label class="instructor-edit-field">Take-home question ${index + 1}<textarea rows="2" data-question-index="${index}" data-question-list="takeHomeQuestions" data-lesson-id="${escapeHtml(lesson.id)}">${escapeHtml(takeHome[index] || "")}</textarea></label>`).join("");
    $("#instructor-course-content").innerHTML = `
      <section class="instructor-course-edit"><p class="eyebrow">COURSE FRAMEWORK · ${escapeHtml(course.category.toUpperCase())}</p><label>Course title<input data-course-field="title" data-course-id="${escapeHtml(course.id)}" value="${escapeHtml(course.title)}"></label><label>Course description<textarea rows="2" data-course-field="description" data-course-id="${escapeHtml(course.id)}">${escapeHtml(course.description)}</textarea></label><label>Final project brief<textarea rows="3" data-final-project="${escapeHtml(course.id)}">${escapeHtml(state.finalProjectEdits[course.id] || window.LEARNTAP_FINAL_PROJECTS[course.id] || `Bring the ${course.title} skills together in a practical project.`)}</textarea></label>
      <div class="instructor-metrics"><div><strong>${lessons.length}</strong><span>Lessons planned</span></div><div><strong>${taughtCount}</strong><span>Lessons taught / reviewed</span></div><div><strong>${courseProgress(course)}%</strong><span>Student progress</span></div><div><strong>${completeCount}</strong><span>Student completions</span></div></div></section>
      <section class="instructor-curriculum-edit"><p class="eyebrow">EDIT THE COURSE STRUCTURE</p><h2>Modules and learning levels</h2>${moduleFields || `<p>This course uses its editable generated lesson framework.</p>`}</section>
      <section class="instructor-course-preparation"><p class="eyebrow">COURSE INTRODUCTION · INSTRUCTOR PREPARATION</p><div class="instructor-edit-grid"><label class="instructor-edit-field">Teaching objectives<textarea rows="3" data-course-teacher-field="objectives" data-course-id="${escapeHtml(course.id)}">${escapeHtml(courseTeacherNotes.objectives || course.skills.join("\n"))}</textarea></label><label class="instructor-edit-field">Preparation notes<textarea rows="3" data-course-teacher-field="preparation" data-course-id="${escapeHtml(course.id)}">${escapeHtml(courseTeacherNotes.preparation || `Prepare a simple demonstration for ${course.title}.` )}</textarea></label><label class="instructor-edit-field">Recommended demonstrations<textarea rows="3" data-course-teacher-field="demonstrations" data-course-id="${escapeHtml(course.id)}">${escapeHtml(courseTeacherNotes.demonstrations || "Show one worked example, then invite learners to practise it.")}</textarea></label><label class="instructor-edit-field">Suggested opening questions<textarea rows="3" data-course-teacher-field="questions" data-course-id="${escapeHtml(course.id)}">${escapeHtml(courseTeacherNotes.questions || "What have you already noticed about this topic?\nWhere might you use this skill?")}</textarea></label></div><p class="instructor-guidance">Expected student outcomes: ${course.skills.map(escapeHtml).join(" · ")}</p></section>
      <section class="instructor-lesson-edit"><div class="instructor-editor-heading"><div><p class="eyebrow">TEACHING NOTE · PRIVATE</p><h2>${escapeHtml(lesson.title)}</h2></div><label class="filter-field"><span>Teaching status</span><select data-teaching-status data-lesson-id="${escapeHtml(lesson.id)}">${teachingStatuses.map(status => `<option ${state.teachingStatus[lesson.id] === status ? "selected" : ""}>${status}</option>`).join("")}</select></label></div>
      <label class="filter-field instructor-lesson-select"><span>Select a lesson · all lessons are available to students</span><select id="instructor-lesson-select">${options}</select></label>
      <details class="instructor-private-note" open><summary>Teaching note builder</summary><p>Teaching approach: Definition → Explanation → Example → Demonstration → Practice → Questions → Project → Assignment → Research.</p><div class="instructor-edit-grid">${fieldMarkup}</div><h3>Questions to ask students</h3><textarea class="teacher-list-editor" rows="4" data-teacher-field="instructorQuestions" data-lesson-id="${escapeHtml(lesson.id)}">${escapeHtml((privateNote.instructorQuestions || lesson.instructorQuestions).join("\n"))}</textarea><h3>Expected understanding / teacher guidance</h3><textarea class="teacher-list-editor" rows="3" data-teacher-field="expectedUnderstanding" data-lesson-id="${escapeHtml(lesson.id)}">${escapeHtml(privateNote.expectedUnderstanding || lesson.expectedUnderstanding)}</textarea><h3>Private instructor notes</h3><textarea class="teacher-list-editor" rows="5" data-teacher-field="notes" data-lesson-id="${escapeHtml(lesson.id)}" placeholder="Preparation, teaching strategy, observations (private to this local instructor view)">${escapeHtml(privateNote.notes || "")}</textarea><h3>Student questions · editable</h3><textarea class="teacher-list-editor" rows="4" data-lesson-field="studentQuestions" data-lesson-id="${escapeHtml(lesson.id)}">${escapeHtml(questions.join("\n"))}</textarea><h3>Take-home assignment · exactly five questions</h3><div class="instructor-edit-grid">${takeHomeFields}</div></details>
      <section class="instructor-student-work"><p class="eyebrow">STUDENT UNDERSTANDING & WORK · LOCAL DEMO</p><label class="filter-field"><span>Understanding assessment</span><select data-understanding-rating data-lesson-id="${escapeHtml(lesson.id)}"><option value="">Not reviewed</option>${understandingRatings.map(rating => `<option ${understanding === rating ? "selected" : ""}>${rating}</option>`).join("")}</select></label><h3>Student practice notes</h3><p>${escapeHtml(studentWork.reflection || "No student practice notes submitted in this browser.")}</p><h3>Take-home assignment response</h3><p>${escapeHtml(studentWork.assignment || "No assignment response submitted in this browser.")}</p></section>
      ${storyboardMarkup}
      <section class="instructor-records"><p class="eyebrow">TEACHING & LEARNING RECORDS</p><h3>Progress snapshot</h3><p>Local learner record: ${isEnrolled(course) ? `${completeCount} of ${lessons.length} lessons complete (${courseProgress(course)}%).` : "No learner enrollment recorded in this browser yet."}</p><p>Assignments: ${lessons.length} lesson assignments planned · Projects: ${escapeHtml(state.finalProjectEdits[course.id] || window.LEARNTAP_FINAL_PROJECTS[course.id] || "Course project framework ready")} · Research tasks: ${lessons.filter(item => item.research).length} suggested</p><p>Video/storyboard material: ${lessons.filter(item => item.video).length} optional storyboard(s) · AI generation is not connected.</p><div class="teaching-status-overview"><h3>Lesson teaching statuses</h3>${lessons.map(item => `<div><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(state.teachingStatus[item.id] || "Lesson Planned")}</strong></div>`).join("")}</div></section>${renderMediaDemoAdmin(course)}
      <p class="instructor-save-state" id="instructor-save-state" aria-live="polite">Edits save automatically in this browser.</p>`;
  }

  function createCourseFromForm(form) {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!title || !category || !description) return;
    const baseId = slug(title);
    let id = baseId || "new-course";
    let suffix = 2;
    while (courseById(id)) id = `${baseId}-${suffix++}`;
    const course = {
      id, title, category, description, level: "Beginner", duration: "Self-paced",
      featured: false, color: "#e4e9e1", icon: title.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase(),
      instructor: "LearnTap Instructor", students: "New course", learningType: "Project-based",
      skills: ["Understand the core concepts", "Apply learning through practice", "Build and present a project"],
      curriculum: [
        { title: "Foundations", lessons: [`Introduction to ${title}`, `Key concepts in ${title}`] },
        { title: "Guided practice", lessons: ["Learn from a worked example", "Practise the essential skills"] },
        { title: "Apply the skills", lessons: ["Plan a small project", "Create a first draft"] },
        { title: "Build and refine", lessons: ["Improve the project", "Review and test the result"] },
        { title: "Final project", lessons: ["Plan the final project", "Present and reflect on the work"] }
      ]
    };
    courses.push(course);
    state.customCourses.push(course);
    instructorCourseId = id;
    instructorLessonId = "";
    saveState();
    form.reset();
    renderInstructor();
    renderHome();
    renderLibrary();
  }

  function renderLessonRoute(parts) {
    const course = courseById(parts[1]);
    if (!course) {
      $("#learning-content").innerHTML = `<div class="not-found"><h1>That learning path is unavailable.</h1><button class="button button-dark" data-route="courses">Browse courses</button></div>`;
      return;
    }
    if (!isEnrolled(course)) state.enrolled.push(course.id);
    currentCourse = course;
    markRecent(course);
    const levels = buildLevels(course);
    const level = levels.find(item => item.id === parts[2]) || levels[0];
    const levelIndex = levels.indexOf(level);
    const moduleIndex = Number(parts[3]) || 0;
    const lessonIndex = Number(parts[4]) || 0;
    currentLevel = level;
    currentLesson = level.modules[moduleIndex]?.lessons[lessonIndex];
    if (!currentLesson) {
      routeTo(`course/${course.id}`);
      return;
    }
    state.currentLessonId = currentLesson.id;
    if (!state.visitedLessons.includes(currentLesson.id)) state.visitedLessons.push(currentLesson.id);
    saveState();
    quizChoice = null;
    renderLesson();
  }

  function renderLesson() {
    if (!currentCourse || !currentLevel || !currentLesson) return;
    const all = allLessons(currentCourse);
    const completed = courseCompleted(currentCourse);
    const lessonPosition = all.findIndex(lesson => lesson.id === currentLesson.id);
    const previous = all[lessonPosition - 1];
    const next = all[lessonPosition + 1];
    const doneCount = all.filter(lesson => completed.includes(lesson.id)).length;
    const module = currentLevel.modules[currentLesson.moduleIndex];
    const video = currentLesson.video;
    const videoState = getVideoState(currentLesson);
    const advanced = currentLevel.id === "advanced";
    const videoMarkup = video ? renderLessonVideo(currentLesson) : "";
    const studentWork = state.studentWork[currentLesson.id] || {};
    $("#learning-content").innerHTML = `<div class="learning-topbar"><button class="back-link" data-route="course/${currentCourse.id}">← ${escapeHtml(currentCourse.title)}</button><button class="text-button" data-route="learning">My learning</button></div>
      <div class="learning-layout"><aside class="lesson-sidebar"><div class="sidebar-course-title"><span class="sidebar-course-icon">${escapeHtml(currentCourse.icon)}</span><div><small>${escapeHtml(currentCourse.category)}</small><strong>${escapeHtml(currentCourse.title)}</strong></div></div><div class="sidebar-progress"><div><span>COURSE PROGRESS</span><strong>${percent(doneCount, all.length)}%</strong></div><div class="progress-track"><span style="width:${percent(doneCount, all.length)}%"></span></div></div>
        ${buildLevels(currentCourse).map(courseLevel => `<div class="sidebar-level ${courseLevel.id === currentLevel.id ? "is-active" : ""}"><span>${courseLevel.name.toUpperCase()}</span>${courseLevel.modules.map((item, mi) => `<div class="sidebar-module"><strong>${escapeHtml(item.title)}</strong>${item.lessons.map((lesson, li) => `<button class="sidebar-lesson ${lesson.id === currentLesson.id ? "current" : ""} ${completed.includes(lesson.id) ? "done" : state.visitedLessons.includes(lesson.id) ? "in-progress" : ""}" data-route="learn/${currentCourse.id}/${courseLevel.id}/${mi}/${li}"><span>${completed.includes(lesson.id) ? "✓" : state.visitedLessons.includes(lesson.id) ? "●" : "·"}</span>${escapeHtml(lesson.title)}</button>`).join("")}</div>`).join("")}</div>`).join("")}
      </aside><article class="lesson-main" id="learning-view-content"><div class="lesson-breadcrumb"><span>LEVEL ${String(currentLesson.levelIndex + 1).padStart(2, "0")}</span><span>/</span><span>${escapeHtml(module.title)}</span><span>/</span><span>LESSON ${String(currentLesson.lessonIndex + 1).padStart(2, "0")}</span></div>${advanced ? `<div class="advanced-learning-notice"><span>ADVANCED LEVEL</span><strong>You are now entering the Advanced Level.</strong><p>These lessons ask you to bring your skills together and make more independent decisions.</p></div>` : ""}<div class="lesson-heading"><p class="eyebrow">${escapeHtml(currentLevel.name.toUpperCase())} LEVEL · ${escapeHtml(currentCourse.category.toUpperCase())}</p><h1>${escapeHtml(currentLesson.title)}</h1><p>${escapeHtml(currentLesson.summary)}</p><div class="lesson-objective"><span>IN THIS LESSON</span><strong>${escapeHtml(currentLesson.objective)}</strong></div></div>
        ${videoMarkup}
        <section class="lesson-content-block"><p class="eyebrow">1 · DEFINITION</p><h2>Start with the meaning.</h2><p>${escapeHtml(currentLesson.definition || currentLesson.summary)}</p></section>
        <section class="lesson-content-block"><p class="eyebrow">2 · EXPLANATION</p><h2>Understand the idea.</h2><p>${escapeHtml(currentLesson.explanation || currentLesson.summary)}</p></section>
        <section class="lesson-example"><span>3 · CLEAN EXAMPLE</span><p>${escapeHtml(currentLesson.example)}</p></section>
        <section class="lesson-content-block"><p class="eyebrow">4 · DEMONSTRATION</p><h2>See how it works.</h2><p>${escapeHtml(currentLesson.demonstration || currentLesson.summary)}</p></section>
        <section class="lesson-keypoints"><p class="eyebrow">KEY POINTS</p><ul>${currentLesson.keyPoints.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
        <section class="lesson-activity"><p class="eyebrow">5 · PRACTICE</p><h2>Try it yourself.</h2><p>${escapeHtml(currentLesson.activity)}</p><label class="reflection-input">Your notes<textarea data-student-work="reflection" rows="3" placeholder="Capture an idea or a first step (saved in this browser)">${escapeHtml(studentWork.reflection || "")}</textarea></label></section>
        <section class="lesson-quiz"><p class="eyebrow">QUICK CHECK</p><h2>${escapeHtml(currentLesson.question)}</h2><div class="lesson-quiz-options">${currentLesson.options.map((option, index) => `<button class="lesson-quiz-option ${quizChoice === index ? (index === currentLesson.answer ? "quiz-right" : "quiz-wrong") : ""}" data-quiz-choice="${index}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join("")}</div><p class="quiz-feedback" aria-live="polite">${quizChoice === null ? "" : quizChoice === currentLesson.answer ? "That's right. You have the main idea." : "Try again, or revisit the explanation above."}</p></section>
        <section class="lesson-keypoints"><p class="eyebrow">QUESTIONS TO CHECK YOUR UNDERSTANDING</p><ol>${currentLesson.studentQuestions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>
        <section class="lesson-content-block"><p class="eyebrow">6 · MINI PROJECT / PRACTICAL TASK</p><h2>Apply what you learned.</h2><p>${escapeHtml(currentLesson.project)}</p></section>
        <section class="lesson-content-block lesson-take-home"><p class="eyebrow">7 · TAKE-HOME ASSIGNMENT · FIVE KEY QUESTIONS</p><h2>Continue learning beyond this lesson.</h2><ol>${currentLesson.takeHomeQuestions.slice(0, 5).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>
        ${currentLesson.research ? `<section class="lesson-content-block"><p class="eyebrow">RESEARCH TASK</p><h2>Look for a real example.</h2><p>${escapeHtml(currentLesson.research)}</p></section>` : ""}
        <label class="reflection-input lesson-reflection">Assignment response<textarea data-student-work="assignment" rows="4" placeholder="Write your response or keep notes for your project">${escapeHtml(studentWork.assignment || "")}</textarea></label>
        <div class="lesson-completion"><div><span>${completed.includes(currentLesson.id) ? "LESSON COMPLETE" : "READY WHEN YOU ARE"}</span><strong>${completed.includes(currentLesson.id) ? "Nice work. Keep building." : "Finished this lesson?"}</strong></div><button class="button button-dark" id="mark-lesson-complete" data-lesson-complete="${currentLesson.id}">${completed.includes(currentLesson.id) ? "Completed ✓" : "Mark lesson complete"}</button></div>
        <nav class="lesson-nav" aria-label="Lesson navigation"><button class="button button-quiet" data-route="${previous ? lessonRoute(currentCourse, previous) : `course/${currentCourse.id}`}" ${previous ? "" : "disabled"}>← Previous lesson</button><span>${doneCount} of ${all.length} lessons complete</span><button class="button button-dark" data-route="${next && (completed.includes(currentLesson.id) || isLessonSequentiallyAvailable(currentCourse, next)) ? lessonRoute(currentCourse, next) : `course/${currentCourse.id}`}" ${next && !completed.includes(currentLesson.id) && !isLessonSequentiallyAvailable(currentCourse, next) ? "disabled" : ""}>${next ? "Next lesson →" : "Course overview"}</button></nav>
      </article></div>`;
  }

  function lessonRoute(course, lesson) {
    return `learn/${course.id}/${levelThemes[lesson.levelIndex]}/${lesson.moduleIndex}/${lesson.lessonIndex}`;
  }

  function isLessonSequentiallyAvailable(course, lesson) {
    return allLessons(course).some(item => item.id === lesson.id);
  }

  function renderLessonVideo(lesson) {
    const definition = lesson.video;
    if (getVideoState(lesson).status !== "ready") {
      return `<section class="lesson-video-fallback"><div class="video-label-row"><span>QUICK VISUAL EXPLANATION</span><small>${definition.duration} seconds</small></div><h2>${escapeHtml(lesson.title)}</h2><p class="video-unavailable">Video unavailable — use the visual explanation below.</p><p>${escapeHtml(definition.summary)}</p>${renderVideoDiagram(definition.scenes[0])}<div class="fallback-summary-columns"><div><strong>Remember</strong><ul>${lesson.keyPoints.slice(0, 3).map(point => `<li>${escapeHtml(point)}</li>`).join("")}</ul></div><div><strong>Example</strong><p>${escapeHtml(lesson.example)}</p></div></div></section>`;
    }
    return `<section class="lesson-video"><div class="video-label-row"><div><span>QUICK VIDEO EXPLANATION</span><p>One concept · visual storyboard</p></div><small>Duration: ${definition.duration} seconds</small></div><div class="video-prototype-note">Storyboard preview · AI video and narration services are not connected.</div><div class="video-stage" id="video-stage" hidden></div><button class="button button-dark" id="watch-video" data-watch-video="${lesson.videoId}">▶ Watch explanation</button></section>`;
  }

  function renderVideoDiagram(scene) {
    return `<div class="video-flow" aria-label="${escapeHtml(scene.label)}">${scene.diagram.map((node, index) => `${index ? `<span aria-hidden="true">→</span>` : ""}<strong>${escapeHtml(node)}</strong>`).join("")}</div>`;
  }

  function renderVideoScene(lesson) {
    const scene = lesson.video.scenes[videoSceneIndex];
    const stage = $("#video-stage");
    if (!stage) return;
    stage.hidden = false;
    stage.innerHTML = `<div class="video-scene-label"><span>SCENE ${videoSceneIndex + 1} / ${lesson.video.scenes.length}</span><strong>${escapeHtml(scene.label)}</strong></div>${renderVideoDiagram(scene)}<p>${escapeHtml(scene.caption)}</p><div class="video-track"><span style="width:${(videoSceneIndex + 1) / lesson.video.scenes.length * 100}%"></span></div><button class="text-button" id="pause-video">${videoPlaying ? "Pause" : "Resume"}</button>`;
  }

  function startVideo(lesson, resume = false) {
    stopVideo();
    if (!resume) videoSceneIndex = 0;
    videoPlaying = true;
    const watch = $("#watch-video");
    if (watch) watch.hidden = true;
    renderVideoScene(lesson);
    videoTimer = window.setInterval(() => {
      if (videoSceneIndex >= lesson.video.scenes.length - 1) {
        stopVideo();
        renderVideoScene(lesson);
        $("#pause-video").textContent = "Replay explanation";
        return;
      }
      videoSceneIndex += 1;
      renderVideoScene(lesson);
    }, lesson.video.duration * 1000 / lesson.video.scenes.length);
  }

  function stopVideo() {
    window.clearInterval(videoTimer);
    videoTimer = null;
    videoPlaying = false;
  }

  function completeLesson(id) {
    const completed = courseCompleted(currentCourse);
    if (!completed.includes(id)) completed.push(id);
    state.completed[currentCourse.id] = completed;
    saveState();
    const next = firstIncompleteLesson(currentCourse);
    if (next && next.id !== id) routeTo(lessonRoute(currentCourse, next));
    else routeTo(`course/${currentCourse.id}`);
  }

  function renderIntro() {
    $("#intro-kicker").textContent = activeIntroSlides[introIndex][0];
    $("#intro-line").textContent = activeIntroSlides[introIndex][1];
    $("#intro-counter").textContent = `${String(introIndex + 1).padStart(2, "0")} / ${String(activeIntroSlides.length).padStart(2, "0")}`;
    $("#intro-progress").style.width = `${(introIndex + 1) / activeIntroSlides.length * 100}%`;
  }

  function playIntro(course = null) {
    activeIntroSlides = course ? [
      ["WELCOME TO THIS COURSE", course.title],
      ["WHAT YOU WILL LEARN", course.skills[0]],
      ["BUILD THE FOUNDATIONS", `Start with guided ${course.title.toLowerCase()} essentials.`],
      ["PRACTICE AS YOU GO", course.skills[1] || course.skills[0]],
      ["BRING IT TOGETHER", course.skills[2] || `Apply your ${course.title.toLowerCase()} skills in a project.`],
      ["YOUR LEARNING PATH", "Basic → Intermediate → Advanced"],
      ["START WHEN YOU ARE READY", "Learn, practice and make your next step count."]
    ] : introSlides;
    $("#intro-course-label").textContent = course ? `${course.category.toUpperCase()} · ${course.duration.toUpperCase()}` : "LEARN PRACTICAL SKILLS · GROW WITH CONFIDENCE";
    introIndex = 0;
    introPlaying = true;
    $("#intro-overlay").hidden = false;
    $("#intro-play-toggle").textContent = "Pause";
    renderIntro();
    introTimer = window.setInterval(() => {
      if (introIndex >= activeIntroSlides.length - 1) {
        stopIntro();
        return;
      }
      introIndex += 1;
      renderIntro();
    }, 9000);
  }

  function stopIntro() {
    window.clearInterval(introTimer);
    introTimer = null;
    introPlaying = false;
    $("#intro-overlay").hidden = true;
  }

  function renderMediaDemoAdmin(courseFilter = null) {
    const mediaCourses = courseFilter ? [courseFilter] : courses;
    const lessons = mediaCourses.flatMap(course => allLessons(course).filter(lesson => lesson.video));
    return `<details class="media-admin"><summary>Media status · demonstration controls</summary><p>These controls simulate the optional-video lifecycle; no video or AI service is connected.</p>${lessons.map(lesson => {
      const status = getVideoState(lesson);
      const label = status.status === "ready" ? "Ready · storyboard" : status.status === "fallback-active" ? "Fallback active" : status.status;
      const action = status.status === "ready" ? `<button class="text-button" data-media-admin="fail" data-video="${lesson.videoId}">Simulate generation failure</button>` : `<button class="text-button" data-media-admin="regenerate" data-video="${lesson.videoId}">Regenerate preview</button>`;
      return `<div class="media-admin-row"><span>${escapeHtml(lesson.title)}</span><strong>${escapeHtml(label)}</strong>${action}</div>`;
    }).join("")}</details>`;
  }

  function videoLessonById(id) {
    return courses.flatMap(course => allLessons(course)).find(lesson => lesson.videoId === id);
  }

  function simulateVideoFailure(lesson) {
    if (!lesson) return;
    const current = getVideoState(lesson);
    updateVideoState(lesson, { status: "generating" });
    window.setTimeout(() => {
      const firstAttempt = Math.min(getVideoState(lesson).attempts + 1, maxVideoAttempts);
      updateVideoState(lesson, { status: "failed", attempts: firstAttempt });
      window.setTimeout(() => {
        const retryAttempt = Math.min(getVideoState(lesson).attempts + 1, maxVideoAttempts);
        updateVideoState(lesson, { status: "fallback-active", attempts: retryAttempt });
        if (current.status === "ready" && current.attempts >= maxVideoAttempts) return;
        renderDashboard();
        if (hash() === "instructor") renderInstructor();
      }, 350);
    }, 350);
  }

  function regenerateVideo(lesson) {
    if (!lesson) return;
    updateVideoState(lesson, { status: "regenerating", attempts: 0 });
    window.setTimeout(() => {
      updateVideoState(lesson, { status: "ready", attempts: 0 });
      renderDashboard();
      if (hash() === "instructor") renderInstructor();
    }, 500);
  }

  document.addEventListener("click", event => {
    const routeControl = event.target.closest("[data-route]");
    if (routeControl) {
      event.preventDefault();
      routeTo(routeControl.dataset.route);
      return;
    }
    const instructorCourse = event.target.closest("[data-instructor-course]");
    if (instructorCourse) {
      instructorCourseId = instructorCourse.dataset.instructorCourse;
      instructorLessonId = "";
      renderInstructor();
      return;
    }
    const action = event.target.closest("[data-action]");
    if (action) {
      if (action.dataset.action === "sign-in" || action.dataset.action === "join") $("#enroll-dialog").showModal();
      if (action.dataset.action === "course-intro") playIntro(courseById(action.dataset.courseId));
      if (action.dataset.action === "complete-project") {
        const course = courseById(action.dataset.courseId);
        if (course) {
          state.projects[course.id] = true;
          saveState();
          renderCourseDetail(course.id);
        }
      }
    }
    const enrollButton = event.target.closest("[data-enroll-course]");
    if (enrollButton) {
      const course = courseById(enrollButton.dataset.enrollCourse);
      if (course && !isEnrolled(course)) state.enrolled.push(course.id);
      state.currentCourse = course?.id || "";
      saveState();
      routeTo(`learn/${course.id}/basic/0/0`);
    }
    const quiz = event.target.closest("[data-quiz-choice]");
    if (quiz) {
      quizChoice = Number(quiz.dataset.quizChoice);
      renderLesson();
    }
    const complete = event.target.closest("[data-lesson-complete]");
    if (complete && !courseCompleted(currentCourse).includes(complete.dataset.lessonComplete)) completeLesson(complete.dataset.lessonComplete);
    const watch = event.target.closest("[data-watch-video]");
    if (watch) startVideo(currentLesson);
    if (event.target.id === "pause-video" && currentLesson) {
      if (videoPlaying) {
        stopVideo();
        renderVideoScene(currentLesson);
      } else if (videoSceneIndex >= currentLesson.video.scenes.length - 1) startVideo(currentLesson);
      else startVideo(currentLesson, true);
    }
    const admin = event.target.closest("[data-media-admin]");
    if (admin) {
      const lesson = videoLessonById(admin.dataset.video);
      if (admin.dataset.mediaAdmin === "fail") simulateVideoFailure(lesson);
      else regenerateVideo(lesson);
    }
    if (event.target.id === "dialog-continue") {
      $("#enroll-dialog").close();
      routeTo("courses");
    }
    if (event.target.id === "intro-play-toggle") {
      if (introPlaying) {
        window.clearInterval(introTimer);
        introTimer = null;
        introPlaying = false;
        event.target.textContent = "Play";
      } else {
        introPlaying = true;
        event.target.textContent = "Pause";
        introTimer = window.setInterval(() => {
          if (introIndex >= activeIntroSlides.length - 1) return stopIntro();
          introIndex += 1;
          renderIntro();
        }, 9000);
      }
    }
    if (event.target.id === "skip-intro") stopIntro();
  });

  document.addEventListener("input", event => {
    const target = event.target;
    if (target.matches("[data-student-work]")) {
      const kind = target.dataset.studentWork;
      state.studentWork[currentLesson.id] = { ...(state.studentWork[currentLesson.id] || {}), [kind]: target.value };
      saveState();
      return;
    }
    if (target.matches("[data-lesson-field]")) {
      const { lessonId, lessonField } = target.dataset;
      state.lessonEdits[lessonId] = state.lessonEdits[lessonId] || {};
      state.lessonEdits[lessonId][lessonField] = lessonField === "studentQuestions"
        ? target.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
        : target.value;
      saveState();
      $("#instructor-save-state").textContent = "Lesson edits saved in this browser.";
      return;
    }
    if (target.matches("[data-storyboard-field]")) {
      const { lessonId, sceneIndex, storyboardField } = target.dataset;
      const edits = state.lessonEdits[lessonId] || {};
      const lesson = allLessons(courseById(instructorCourseId)).find(item => item.id === lessonId);
      const sourceStoryboard = edits.storyboard || lesson?.video?.storyboard;
      if (!Array.isArray(sourceStoryboard)) return;
      const storyboard = sourceStoryboard.map(scene => ({ ...scene }));
      storyboard[Number(sceneIndex)] = { ...storyboard[Number(sceneIndex)], [storyboardField]: target.value };
      state.lessonEdits[lessonId] = { ...edits, storyboard };
      saveState();
      $("#instructor-save-state").textContent = "Storyboard edit saved in this browser.";
      return;
    }
    if (target.matches("[data-module-field]")) {
      state.moduleEdits[`${target.dataset.courseId}:${target.dataset.moduleField}`] = target.value;
      saveState();
      $("#instructor-save-state").textContent = "Module title saved in this browser.";
      return;
    }
    if (target.matches("[data-final-project]")) {
      state.finalProjectEdits[target.dataset.finalProject] = target.value;
      saveState();
      $("#instructor-save-state").textContent = "Final project brief saved in this browser.";
      return;
    }
    if (target.matches("[data-question-list]")) {
      const { lessonId, questionIndex, questionList } = target.dataset;
      const lesson = allLessons(courseById(instructorCourseId)).find(item => item.id === lessonId);
      const questions = (state.lessonEdits[lessonId]?.[questionList] || lesson?.[questionList] || []).slice(0, 5);
      while (questions.length < 5) questions.push("");
      questions[Number(questionIndex)] = target.value;
      state.lessonEdits[lessonId] = { ...(state.lessonEdits[lessonId] || {}), [questionList]: questions };
      saveState();
      $("#instructor-save-state").textContent = "Take-home questions saved. Exactly five question slots are maintained.";
      return;
    }
    if (target.matches("[data-teacher-field]")) {
      const { lessonId, teacherField } = target.dataset;
      state.teacherNotes[lessonId] = state.teacherNotes[lessonId] || {};
      state.teacherNotes[lessonId][teacherField] = teacherField === "instructorQuestions"
        ? target.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
        : target.value;
      saveState();
      $("#instructor-save-state").textContent = "Private instructor note saved in this browser.";
      return;
    }
    if (target.matches("[data-course-teacher-field]")) {
      const key = `course:${target.dataset.courseId}`;
      state.teacherNotes[key] = state.teacherNotes[key] || {};
      state.teacherNotes[key][target.dataset.courseTeacherField] = target.value;
      saveState();
      $("#instructor-save-state").textContent = "Private course teaching note saved in this browser.";
      return;
    }
    if (target.matches("[data-course-field]")) {
      const { courseId, courseField } = target.dataset;
      const course = courseById(courseId);
      if (!course) return;
      course[courseField] = target.value;
      state.courseEdits[courseId] = { ...(state.courseEdits[courseId] || {}), [courseField]: target.value };
      state.customCourses = state.customCourses.map(item => item.id === courseId ? { ...item, [courseField]: target.value } : item);
      saveState();
      $("#instructor-save-state").textContent = "Course framework saved in this browser.";
    }
  });

  document.addEventListener("change", event => {
    const target = event.target;
    if (target.id === "instructor-course-select") {
      instructorCourseId = target.value;
      instructorLessonId = "";
      renderInstructor();
    } else if (target.id === "instructor-lesson-select") {
      instructorLessonId = target.value;
      renderInstructor();
    } else if (target.matches("[data-teaching-status]")) {
      const status = teachingStatuses.includes(target.value) ? target.value : teachingStatuses[0];
      state.teachingStatus[target.dataset.lessonId] = status;
      saveState();
      renderInstructor();
    } else if (target.matches("[data-understanding-rating]")) {
      state.studentUnderstanding[target.dataset.lessonId] = understandingRatings.includes(target.value) ? target.value : "";
      saveState();
      renderInstructor();
    } else if (target.matches("[data-module-level]")) {
      state.moduleLevels[`${target.dataset.courseId}:${target.dataset.moduleLevel}`] = Number(target.value);
      saveState();
      instructorLessonId = "";
      renderInstructor();
    } else if (target.matches("[data-lesson-order]")) {
      state.lessonOrders[target.dataset.lessonOrder] = Math.max(1, Number(target.value) || 1);
      saveState();
      instructorLessonId = "";
      renderInstructor();
    } else if (target.matches("[data-course-field]")) {
      renderHome();
      renderLibrary();
      renderInstructor();
    }
  });

  $("#create-course-form").addEventListener("submit", event => {
    event.preventDefault();
    createCourseFromForm(event.currentTarget);
  });

  $("#menu-toggle").addEventListener("click", () => {
    const open = $("#menu-toggle").getAttribute("aria-expanded") === "true";
    $("#menu-toggle").setAttribute("aria-expanded", String(!open));
    $("#main-nav").classList.toggle("open", !open);
  });
  ["course-search", "category-filter", "level-filter", "duration-filter", "learning-type-filter", "instructor-filter", "progress-filter", "sort-filter"].forEach(id => {
    const element = $(`#${id}`);
    element.addEventListener(id === "course-search" ? "input" : "change", renderLibrary);
  });
  $("#clear-filters").addEventListener("click", () => {
    $("#course-search").value = "";
    $("#category-filter").value = "";
    $("#level-filter").value = "";
    $("#duration-filter").value = "";
    $("#learning-type-filter").value = "";
    $("#instructor-filter").value = "";
    $("#progress-filter").value = "";
    $("#sort-filter").value = "featured";
    activeFilterCategory = "";
    renderLibrary();
  });
  $("#enroll-dialog").addEventListener("click", event => {
    if (event.target === $("#enroll-dialog")) $("#enroll-dialog").close();
  });
  $("#enroll-dialog").addEventListener("close", event => {
    if (event.target.returnValue === "continue") routeTo("courses");
  });
  $("#learning-content").addEventListener("click", event => {
    if (!event.target.closest("[data-quiz-choice]")) return;
  });
  window.addEventListener("hashchange", () => navigate(hash()));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (!$("#intro-overlay").hidden) stopIntro();
      return;
    }
    if (!event.target.closest(".lesson-main")) return;
    if (event.key === "ArrowRight" && currentCourse && currentLesson) {
      const next = allLessons(currentCourse)[allLessons(currentCourse).findIndex(lesson => lesson.id === currentLesson.id) + 1];
      if (next && isLessonSequentiallyAvailable(currentCourse, next)) routeTo(lessonRoute(currentCourse, next));
    }
  });

  renderHome();
  renderLibrary();
  renderDashboard();
  if (hash() !== "home") navigate(hash());
})();
