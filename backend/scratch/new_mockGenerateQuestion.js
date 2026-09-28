
// RESUME-GROUNDED mockGenerateQuestion REPLACEMENT
// This file patches backend/services/aiService.js
// The full new function is below — paste to replace lines 1299-1704

function mockGenerateQuestion(resumeData, history, config, nextIndex, targetCategory, targetDifficulty, forceTargetPos, usedQuestionTexts = new Set()) {
  // ===================================================================
  // RESUME-GROUNDED QUESTION GENERATOR
  // ALL questions must be traceable to a skill/technology in the resume.
  // NEVER fall back to generic MongoDB/OS/CORS/JWT/PostgreSQL if those
  // items are absent from the current candidate's resume.
  // ===================================================================

  const modeType = config?.type || 'Mixed';
  const requestedDiff = targetDifficulty || config?.difficulty || 'Medium';
  const projs = resumeData?.projects?.length ? resumeData.projects : [];

  // Build the ALLOWED skill set STRICTLY from the resume
  const resumeLangs   = (resumeData?.skills?.languages   || []).filter(Boolean);
  const resumeFworks  = (resumeData?.skills?.frameworks  || []).filter(Boolean);
  const resumeDbs     = (resumeData?.skills?.databases   || []).filter(Boolean);
  const resumeTechs   = (resumeData?.skills?.technologies|| []).filter(Boolean);

  const isProjectCategory = (
    modeType === 'Project-based' ||
    targetCategory === 'Projects' ||
    targetCategory === 'Project Architecture' ||
    targetCategory === 'Database Design' ||
    targetCategory === 'Security & Auth' ||
    targetCategory === 'API Communication' ||
    targetCategory === 'Deployment & Challenges' ||
    targetCategory === 'Tech Stack Decisions'
  );

  // For project-based questions with no real projects -> fall back to technical
  if (!projs.length && isProjectCategory) {
    return generateDynamicTechnicalQuestion(resumeData, { category: targetCategory, difficulty: requestedDiff }, nextIndex, forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4), usedQuestionTexts);
  }

  const project1 = projs.length ? (projs[nextIndex % projs.length] || projs[0]) : null;

  // ---- Skill selectors (only from resume, no generic fallbacks) ----
  const pickLang  = resumeLangs.length  ? resumeLangs [nextIndex % resumeLangs.length]  : null;
  const pickFwork = resumeFworks.length ? resumeFworks[nextIndex % resumeFworks.length] : null;
  const pickDb    = resumeDbs.length    ? resumeDbs   [nextIndex % resumeDbs.length]    : null;
  const pickTech  = resumeTechs.length  ? resumeTechs [nextIndex % resumeTechs.length]  : null;

  // ================================================================
  // BUILD RESUME-SKILL-BASED TECHNICAL QUESTION BANK
  // Every entry uses ONLY skills the candidate actually listed.
  // ================================================================
  const resumeTechPool = [];

  // --- Language-based questions ---
  resumeLangs.forEach((lang) => {
    const langLower = lang.toLowerCase();

    // Universal: error handling
    resumeTechPool.push({
      questionText: `When writing software in ${lang}, what is the primary purpose of using try/catch error-handling blocks?`,
      correctText: `To handle runtime errors gracefully and prevent application crashes`,
      wrongTexts: [`To increase execution speed`, `To clear unused memory variables`, `To compile code into binary`],
      topic: lang, category: 'Technical Skills'
    });
    // Universal: memory / GC
    resumeTechPool.push({
      questionText: `In ${lang}, how does the runtime manage memory for objects that are no longer referenced?`,
      correctText: `Through automatic garbage collection or reference-counting cleanup that reclaims unused heap memory`,
      wrongTexts: [`The programmer must manually free every allocation`, `Memory is never reclaimed until the OS reboots`, `Memory leaks are silently ignored`],
      topic: lang, category: 'Technical Skills'
    });

    if (langLower === 'python') {
      resumeTechPool.push({ questionText: `In Python, which built-in data structure stores key-value pairs and allows O(1) average-case lookup?`, correctText: `Dictionary (dict)`, wrongTexts: [`List`, `Tuple`, `Set`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what is the difference between a list comprehension and a generator expression?`, correctText: `List comprehensions evaluate eagerly and store all values in memory; generators evaluate lazily and yield values one at a time`, wrongTexts: [`They are identical in memory usage`, `Generator expressions are faster only for small lists`, `List comprehensions cannot be nested`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `Which Python keyword is used to define a function that can pause execution and yield values one at a time?`, correctText: `yield`, wrongTexts: [`async`, `return`, `lambda`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what does the __init__ method in a class represent?`, correctText: `The constructor method that initialises object attributes when a new instance is created`, wrongTexts: [`A static method for class-level operations`, `A destructor that frees memory`, `A method for string serialization`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, how do you handle multiple exception types in a single except block?`, correctText: `By grouping them in a tuple: except (TypeError, ValueError):`, wrongTexts: [`By using multiple except keywords on the same line`, `By using the catch keyword`, `By nesting if-else inside the except block`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python OOP, what is the purpose of the 'self' parameter in method definitions?`, correctText: `It refers to the current instance of the class, allowing access to instance attributes and methods`, wrongTexts: [`It refers to the class itself, like a static keyword`, `It is optional and rarely used`, `It represents the return value of the method`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what is a decorator and what is its primary use?`, correctText: `A function that wraps another function to add behaviour (e.g., logging, authentication) without modifying the original function's code`, wrongTexts: [`A CSS styling mechanism for Python UIs`, `A built-in function for string formatting`, `A keyword that defines abstract methods`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what is the difference between mutable and immutable data types? Give one example of each.`, correctText: `Mutable types (e.g., list, dict) can be changed after creation; immutable types (e.g., str, tuple) cannot be modified once created`, wrongTexts: [`All Python data types are mutable`, `Immutable types can be modified using indexing`, `Mutable means read-only`], topic: 'Python', category: 'Technical Skills' });
    }

    if (langLower === 'java') {
      resumeTechPool.push({ questionText: `In Java, what is the difference between an interface and an abstract class?`, correctText: `An interface defines a contract with only abstract methods (Java 8+ allows default methods), while an abstract class can have both abstract and concrete methods with state`, wrongTexts: [`Interfaces can have instance variables; abstract classes cannot`, `Abstract classes support multiple inheritance; interfaces do not`, `There is no practical difference in Java`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, which collection class is backed by a hash table and allows null keys and values?`, correctText: `HashMap`, wrongTexts: [`TreeMap`, `LinkedHashMap`, `Hashtable`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, what keyword prevents a class from being subclassed or a method from being overridden?`, correctText: `final`, wrongTexts: [`static`, `abstract`, `sealed`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java exception handling, what is the difference between checked and unchecked exceptions?`, correctText: `Checked exceptions are verified at compile time and must be caught or declared; unchecked exceptions (RuntimeException subclasses) are not enforced at compile time`, wrongTexts: [`Unchecked exceptions are always fatal`, `Checked exceptions occur only in I/O operations`, `There is no distinction in Java 11+`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, which OOP principle is demonstrated when a child class provides a specific implementation of a method declared in a parent class?`, correctText: `Method Overriding (Runtime Polymorphism)`, wrongTexts: [`Encapsulation`, `Method Overloading`, `Abstraction`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is the role of the Java Virtual Machine (JVM) in executing Java programs?`, correctText: `It interprets Java bytecode and provides platform independence, memory management, and garbage collection`, wrongTexts: [`It compiles Java source code directly to machine code`, `It only manages network connections`, `It replaces the operating system kernel`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, what is the purpose of the 'static' keyword when applied to a class member?`, correctText: `It makes the member belong to the class itself rather than any instance, so it is shared across all objects`, wrongTexts: [`It makes the member private and inaccessible`, `It prevents the member from being modified`, `It automatically serialises the member to disk`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, how does the 'ArrayList' differ from an array?`, correctText: `ArrayList is a resizable collection that automatically grows when elements are added; arrays have a fixed size set at creation`, wrongTexts: [`Arrays are faster for all operations`, `ArrayList can only store strings`, `Arrays and ArrayList are identical in Java`], topic: 'Java', category: 'Technical Skills' });
    }

    if (langLower === 'c') {
      resumeTechPool.push({ questionText: `In C, what is the purpose of a pointer variable?`, correctText: `A pointer stores the memory address of another variable, enabling direct memory access and manipulation`, wrongTexts: [`A pointer is a special type of integer`, `A pointer stores the value of a variable`, `A pointer is used only for function arguments`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what function is used to allocate memory dynamically at runtime on the heap?`, correctText: `malloc() (or calloc() / realloc())`, wrongTexts: [`alloc()`, `new()`, `reserve()`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what is the difference between pass-by-value and pass-by-pointer?`, correctText: `Pass-by-value sends a copy of the variable; pass-by-pointer sends the address so the function can modify the original`, wrongTexts: [`They behave identically`, `Pass-by-pointer is always slower`, `Pass-by-value is only for struct types`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what happens if you forget to call free() on a dynamically allocated memory block?`, correctText: `Memory leak — the allocated memory is not returned to the OS until the program terminates`, wrongTexts: [`The program automatically recycles the memory`, `The compiler raises a linker error`, `The OS immediately reclaims the memory`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is a segmentation fault in C and what typically causes it?`, correctText: `A runtime error caused by accessing memory outside allocated bounds, such as dereferencing a NULL or dangling pointer`, wrongTexts: [`A compiler warning about unused variables`, `An error caused by an infinite loop`, `A type mismatch between int and float`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what is the role of the 'struct' keyword?`, correctText: `It defines a user-defined composite data type that groups related variables of different types under one name`, wrongTexts: [`It declares a function prototype`, `It allocates dynamic memory`, `It defines a class with methods`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what is the difference between a stack and a heap memory region?`, correctText: `Stack memory is automatically managed for local variables and function calls; heap memory is manually managed with malloc/free for dynamic allocation`, wrongTexts: [`Stack memory is unlimited; heap is restricted`, `Heap memory is faster than stack memory`, `Stack and heap refer to the same memory region`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, how do arrays and pointers relate to each other?`, correctText: `An array name decays to a pointer to its first element, so pointer arithmetic can be used to traverse array elements`, wrongTexts: [`Arrays and pointers are completely unrelated in C`, `Array indexing is always safer than pointer arithmetic`, `Pointers cannot point to array elements`], topic: 'C', category: 'Technical Skills' });
    }

    if (langLower === 'html') {
      resumeTechPool.push({ questionText: `In HTML, what is the purpose of semantic elements such as <header>, <main>, and <footer>?`, correctText: `They convey the meaning and structure of content to browsers and accessibility tools, improving SEO and readability`, wrongTexts: [`They only change the visual appearance of the page`, `They replace CSS stylesheets`, `They are required to use JavaScript`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML forms, what does the 'action' attribute of a <form> element specify?`, correctText: `The URL to which the form data is submitted when the user clicks the submit button`, wrongTexts: [`The CSS class applied to the form`, `The method used for data encryption`, `The JavaScript function to validate input`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML, which attribute is used to associate a <label> element with its corresponding input field for accessibility?`, correctText: `The 'for' attribute on <label> matching the 'id' attribute of the input`, wrongTexts: [`The 'name' attribute`, `The 'class' attribute`, `The 'aria' attribute`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is the difference between block-level and inline HTML elements?`, correctText: `Block-level elements (e.g., <div>, <p>) take up the full width and start on a new line; inline elements (e.g., <span>, <a>) occupy only their content width`, wrongTexts: [`Block elements are only used for tables`, `Inline elements cannot contain text`, `There is no visual difference between them`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML, what is the purpose of the <meta charset="UTF-8"> tag?`, correctText: `It declares the character encoding for the HTML document so the browser renders text characters correctly`, wrongTexts: [`It links an external stylesheet`, `It sets the page title in the browser tab`, `It defines the viewport width for mobile devices`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML, what is the difference between the 'id' and 'class' attributes?`, correctText: `'id' must be unique per page and identifies a single element; 'class' can be shared by multiple elements for shared styling`, wrongTexts: [`'id' applies to multiple elements; 'class' applies to one`, `They are interchangeable attributes`, `'class' is deprecated in HTML5`], topic: 'HTML', category: 'Technical Skills' });
    }

    if (langLower === 'css') {
      resumeTechPool.push({ questionText: `In CSS, what does the box model consist of?`, correctText: `Content, Padding, Border, and Margin — from innermost to outermost`, wrongTexts: [`Header, Body, Footer, and Sidebar`, `Width, Height, Color, and Font`, `Flex, Grid, Float, and Position`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS, what is the difference between 'position: relative' and 'position: absolute'?`, correctText: `Relative moves an element relative to its normal position without removing it from document flow; absolute removes it from flow and positions it relative to the nearest positioned ancestor`, wrongTexts: [`They are identical and produce the same layout`, `Absolute is for mobile only`, `Relative is deprecated in modern CSS`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What CSS property makes a container a Flexbox layout?`, correctText: `display: flex`, wrongTexts: [`flex: 1`, `layout: flex`, `align: flexbox`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS, how do media queries enable responsive design?`, correctText: `They apply different CSS rules based on the device's screen width, resolution, or orientation`, wrongTexts: [`They detect the user's operating system and adjust fonts`, `They load different HTML files for mobile and desktop`, `They compress images automatically`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS specificity, which selector type has the highest specificity?`, correctText: `Inline styles (style="...") have the highest specificity among normal declarations`, wrongTexts: [`Class selectors (.class)`, `Element selectors (div, p)`, `Universal selectors (*)`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS, what is the purpose of the 'z-index' property?`, correctText: `It controls the stacking order of positioned elements; higher z-index values appear in front of lower ones`, wrongTexts: [`It sets the element's opacity level`, `It controls the element's horizontal alignment`, `It defines the element's font size`], topic: 'CSS', category: 'Technical Skills' });
    }

    if (langLower === 'c++') {
      resumeTechPool.push({ questionText: `In C++, what is the purpose of a constructor and destructor?`, correctText: `A constructor initialises an object when it is created; a destructor releases resources when the object is destroyed`, wrongTexts: [`Constructors are only used for static objects`, `Destructors increase memory usage`, `Both are optional in C++`], topic: 'C++', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C++, what is function overloading?`, correctText: `Defining multiple functions with the same name but different parameter types or counts, resolved at compile time`, wrongTexts: [`Calling the same function from different classes`, `Overriding a virtual function in a derived class`, `Using templates to generate functions`], topic: 'C++', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C++, what does the 'virtual' keyword enable?`, correctText: `Runtime polymorphism — the correct overridden method in a derived class is called via a base class pointer or reference`, wrongTexts: [`It makes the function run faster`, `It prevents the function from being called`, `It declares the function as a template`], topic: 'C++', category: 'Technical Skills' });
    }

    if (langLower === 'javascript') {
      resumeTechPool.push({ questionText: `In JavaScript, what is the difference between 'let', 'const', and 'var'?`, correctText: `'var' is function-scoped and hoisted; 'let' and 'const' are block-scoped — 'let' allows reassignment while 'const' does not`, wrongTexts: [`They are completely interchangeable`, `'const' prevents the object from being modified`, `'var' is block-scoped in strict mode`], topic: 'JavaScript', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In JavaScript, what does the 'async/await' syntax do?`, correctText: `It allows writing asynchronous code in a synchronous style by pausing execution at 'await' until a Promise resolves`, wrongTexts: [`It creates multithreaded workers`, `It synchronously blocks the event loop`, `It replaces callbacks and Promises entirely`], topic: 'JavaScript', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In JavaScript, what is the difference between '==' and '==='?`, correctText: `'==' performs type coercion before comparing; '===' (strict equality) requires both value and type to match`, wrongTexts: [`They are identical operators`, `'===' only works with numbers`, `'==' is deprecated in modern JavaScript`], topic: 'JavaScript', category: 'Technical Skills' });
    }

    if (langLower === 'sql') {
      resumeTechPool.push({ questionText: `In SQL, what is the difference between INNER JOIN and LEFT JOIN?`, correctText: `INNER JOIN returns only matching rows from both tables; LEFT JOIN returns all rows from the left table plus matching rows from the right (NULL if no match)`, wrongTexts: [`They produce identical result sets`, `LEFT JOIN is deprecated`, `INNER JOIN includes unmatched rows from both tables`], topic: 'SQL', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In SQL, what is the purpose of the GROUP BY clause?`, correctText: `It groups rows that share the same values in specified columns so aggregate functions (COUNT, SUM, AVG) can be applied per group`, wrongTexts: [`It sorts the result set alphabetically`, `It filters rows like the WHERE clause`, `It joins two tables on a common column`], topic: 'SQL', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In SQL, what does the HAVING clause do, and how does it differ from WHERE?`, correctText: `HAVING filters groups after GROUP BY aggregation; WHERE filters individual rows before aggregation`, wrongTexts: [`HAVING and WHERE are interchangeable`, `WHERE filters after GROUP BY`, `HAVING replaces the GROUP BY clause`], topic: 'SQL', category: 'Technical Skills' });
    }
  }); // end resumeLangs.forEach

  // --- Framework-based questions ---
  resumeFworks.forEach((fw) => {
    const fwLower = fw.toLowerCase();

    resumeTechPool.push({
      questionText: `When developing with ${fw}, what is the recommended approach for fetching external data on component or module initialisation?`,
      correctText: `Using asynchronous API calls inside lifecycle hooks or controller middleware`,
      wrongTexts: [`Fetching data inside CSS stylesheets`, `Reloading the page on every render`, `Hardcoding data in the component template`],
      topic: fw, category: 'Technical Skills'
    });

    if (fwLower === 'react') {
      resumeTechPool.push({ questionText: `In React, what is the purpose of the 'useState' hook?`, correctText: `It declares a stateful variable and a setter function that triggers a re-render when the state changes`, wrongTexts: [`It fetches data from an API`, `It handles routing between pages`, `It applies CSS styles dynamically`], topic: 'React', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In React, how do you pass data from a parent component to a child component?`, correctText: `Through props — the parent includes the data as an attribute on the child component's JSX element`, wrongTexts: [`Through global window variables`, `By directly modifying the child's state`, `Through the browser's localStorage`], topic: 'React', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In React, what problem does the 'useEffect' hook solve?`, correctText: `It lets you perform side effects (data fetching, subscriptions, DOM manipulation) after a component renders`, wrongTexts: [`It prevents re-renders`, `It defines global CSS styles`, `It creates new React contexts`], topic: 'React', category: 'Technical Skills' });
    }
    if (fwLower === 'django' || fwLower === 'flask') {
      resumeTechPool.push({ questionText: `In ${fw}, how are URL routes mapped to view functions?`, correctText: `Through URL configuration patterns that associate URL paths with handler functions or class-based views`, wrongTexts: [`Through CSS file imports`, `Through database schema definitions`, `Through frontend JavaScript routing`], topic: fw, category: 'Technical Skills' });
    }
    if (fwLower === 'express' || fwLower.includes('node')) {
      resumeTechPool.push({ questionText: `In ${fw}, what is the role of middleware functions in the request-response cycle?`, correctText: `Middleware functions execute between receiving a request and sending a response, handling tasks like authentication, logging, and body parsing`, wrongTexts: [`Middleware only handles database connections`, `Middleware replaces route handlers`, `Middleware is executed only on errors`], topic: fw, category: 'Technical Skills' });
    }
    if (fwLower === 'bootstrap') {
      resumeTechPool.push({ questionText: `In Bootstrap, how does the grid system create responsive layouts?`, correctText: `Using a 12-column fluid grid with breakpoint-specific column classes (e.g., col-md-6) that rearrange at different screen widths`, wrongTexts: [`Through custom CSS variables only`, `By loading separate HTML files per device`, `Using JavaScript animations`], topic: 'Bootstrap', category: 'Technical Skills' });
    }
    if (fwLower === 'tailwind') {
      resumeTechPool.push({ questionText: `In Tailwind CSS, how do you apply responsive styles to an element?`, correctText: `Using breakpoint prefix classes such as 'md:text-lg' or 'lg:flex' that activate at specified screen widths`, wrongTexts: [`Writing separate CSS files for each screen size`, `Using JavaScript media query listeners`, `Adding inline style attributes`], topic: 'Tailwind', category: 'Technical Skills' });
    }
  });

  // --- Database-based questions ---
  resumeDbs.forEach((db) => {
    const dbLower = db.toLowerCase();
    resumeTechPool.push({ questionText: `In ${db}, which technique is most effective for accelerating search query performance on large datasets?`, correctText: `Creating indexes on frequently queried fields and projecting only required fields`, wrongTexts: [`Performing full collection/table scans on every request`, `Removing primary key constraints`, `Disabling query caching`], topic: db, category: 'DBMS' });
    resumeTechPool.push({ questionText: `In ${db}, how do you ensure entity uniqueness and prevent duplicate records?`, correctText: `Enforcing unique constraints, primary keys, or unique index rules on the relevant fields`, wrongTexts: [`Allowing all inserts and handling duplicates in the application layer`, `Removing all schema validation`, `Storing records in flat text files`], topic: db, category: 'DBMS' });
    if (dbLower === 'mongodb') {
      resumeTechPool.push({ questionText: `In MongoDB, what is the difference between embedding documents and referencing documents?`, correctText: `Embedding stores related data in the same document for fast reads; referencing stores a link (ObjectId) to another document, better for large or frequently updated data`, wrongTexts: [`They are identical in performance`, `Referencing is always faster than embedding`, `Embedding is only for arrays of strings`], topic: 'MongoDB', category: 'DBMS' });
      resumeTechPool.push({ questionText: `In MongoDB, what is the purpose of an index?`, correctText: `An index is a data structure that improves query speed by allowing MongoDB to find documents without scanning every document in the collection`, wrongTexts: [`Indexes store backup copies of collections`, `Indexes replace the need for a schema`, `Indexes are only used for sorting`], topic: 'MongoDB', category: 'DBMS' });
    }
    if (dbLower === 'mysql' || dbLower === 'postgresql') {
      resumeTechPool.push({ questionText: `In ${db}, what is the purpose of a foreign key constraint?`, correctText: `It enforces referential integrity by ensuring a column value in one table matches a primary key in another table`, wrongTexts: [`It speeds up SELECT queries`, `It prevents NULL values in a column`, `It encrypts sensitive column data`], topic: db, category: 'DBMS' });
      resumeTechPool.push({ questionText: `In ${db}, what is a database transaction and what does ACID stand for?`, correctText: `A transaction is a unit of work that must complete fully or not at all; ACID stands for Atomicity, Consistency, Isolation, Durability`, wrongTexts: [`A transaction is just a SELECT query`, `ACID stands for Asynchronous Concurrent I/O Dispatcher`, `Transactions are only needed for DELETE operations`], topic: db, category: 'DBMS' });
    }
    if (dbLower === 'firebase') {
      resumeTechPool.push({ questionText: `In Firebase Realtime Database, how does data synchronisation work between clients?`, correctText: `Data is stored as JSON and synchronised in real-time to all connected clients whenever it changes`, wrongTexts: [`Clients must poll the server every 5 seconds`, `Data is sent only on page refresh`, `Firebase uses SOAP XML for synchronisation`], topic: 'Firebase', category: 'DBMS' });
    }
    if (dbLower === 'sqlite') {
      resumeTechPool.push({ questionText: `What makes SQLite different from client-server database systems like MySQL?`, correctText: `SQLite is a serverless, file-based database that runs in-process with the application, requiring no separate server setup`, wrongTexts: [`SQLite requires a dedicated server process`, `SQLite supports unlimited concurrent writes`, `SQLite stores data in JSON files`], topic: 'SQLite', category: 'DBMS' });
    }
  });

  // --- Technology-based questions ---
  resumeTechs.forEach((tech) => {
    const techLower = tech.toLowerCase();

    resumeTechPool.push({
      questionText: `When integrating ${tech} into your development workflow, what is the best practice for storing sensitive configuration credentials?`,
      correctText: `Storing secrets in environment variables (.env files) outside version control repositories`,
      wrongTexts: [`Hardcoding API keys in public source code commits`, `Embedding passwords in HTML template files`, `Storing credentials in browser localStorage`],
      topic: tech, category: 'Technologies'
    });

    if (techLower === 'git' || techLower === 'github') {
      resumeTechPool.push({ questionText: `In Git version control, what is the standard workflow for integrating a feature branch into the main production branch?`, correctText: `Creating a Pull Request (PR), performing a code review, and merging after approval`, wrongTexts: [`Force pushing the feature branch directly to main`, `Deleting the repository and re-cloning`, `Overwriting local changes without committing`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Git, what is the purpose of the 'git stash' command?`, correctText: `It temporarily saves uncommitted changes so you can switch branches without committing incomplete work`, wrongTexts: [`It permanently deletes uncommitted changes`, `It pushes changes to a remote branch`, `It merges two branches together`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `What is a Git branch and why is it used in collaborative development?`, correctText: `A branch is a lightweight movable pointer to a commit that lets developers work on features or fixes in isolation without affecting the main codebase`, wrongTexts: [`A branch is a copy of the entire repository`, `Branches are only used for backup purposes`, `Branches eliminate the need for commits`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Git, what does 'git rebase' do, and how does it differ from 'git merge'?`, correctText: `Rebase replays commits from one branch on top of another creating a linear history; merge creates a merge commit preserving branch history`, wrongTexts: [`Rebase deletes remote branches`, `Merge is faster than rebase in all cases`, `They produce identical commit histories`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Git, what is the difference between 'git fetch' and 'git pull'?`, correctText: `'git fetch' downloads remote changes without merging; 'git pull' fetches and automatically merges the remote branch into the current local branch`, wrongTexts: [`They are identical commands`, `'git pull' only downloads code; 'git fetch' merges it`, `'git fetch' deletes local branches`], topic: tech, category: 'Technologies' });
    }

    if (techLower === 'aws') {
      resumeTechPool.push({ questionText: `In AWS, what is the primary purpose of Amazon S3?`, correctText: `Scalable object storage for files, backups, static website hosting, and data archiving`, wrongTexts: [`Running virtual machines`, `Managing relational databases`, `Setting up a content delivery network`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS, what does EC2 provide?`, correctText: `On-demand virtual server instances (compute) that can be configured with different OS, CPU, and memory`, wrongTexts: [`A managed NoSQL database service`, `A DNS routing service`, `An email delivery platform`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS cloud computing, what is the shared responsibility model?`, correctText: `AWS is responsible for the security OF the cloud (hardware, infrastructure); customers are responsible for security IN the cloud (data, IAM, app config)`, wrongTexts: [`AWS manages all customer application code and data`, `Customers manage the physical data centre hardware`, `Both parties have no security responsibilities`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS, what is an IAM role and why is it used?`, correctText: `An IAM role grants specific permissions to AWS services or users without sharing long-term credentials, following the principle of least privilege`, wrongTexts: [`An IAM role is a type of EC2 instance`, `IAM roles store application database credentials`, `IAM roles replace virtual private clouds`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS, what is the difference between vertical and horizontal scaling?`, correctText: `Vertical scaling increases the capacity of a single server (more CPU/RAM); horizontal scaling adds more server instances to distribute load`, wrongTexts: [`They are the same concept`, `Horizontal scaling increases a single server's CPU`, `Vertical scaling adds more servers`], topic: 'AWS', category: 'Technologies' });
    }

    if (techLower === 'machine learning') {
      resumeTechPool.push({ questionText: `In Machine Learning, what is the difference between supervised and unsupervised learning?`, correctText: `Supervised learning trains models on labelled data with known outputs; unsupervised learning finds patterns in unlabelled data without predefined answers`, wrongTexts: [`Supervised learning uses more data`, `Unsupervised learning always produces more accurate models`, `There is no practical difference`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Machine Learning, what is overfitting and how can it be prevented?`, correctText: `Overfitting occurs when a model learns training data too closely and fails to generalise; it can be prevented by regularisation, cross-validation, or using more diverse training data`, wrongTexts: [`Overfitting means the model underfits the training data`, `It is solved by increasing the number of features`, `Overfitting only occurs in unsupervised models`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Machine Learning classification, what does the term 'precision' measure?`, correctText: `The proportion of predicted positives that are actually positive: TP / (TP + FP)`, wrongTexts: [`The proportion of actual positives correctly identified (that is recall)`, `The overall accuracy of the model`, `The number of training epochs`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is the role of a training set and a test set in a Machine Learning workflow?`, correctText: `The training set is used to fit the model; the test set is held out to evaluate how well the model generalises to unseen data`, wrongTexts: [`Both sets are used simultaneously during training`, `The test set is used to tune hyperparameters`, `The training set is always smaller than the test set`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Machine Learning, what is the purpose of feature scaling (e.g., normalisation or standardisation)?`, correctText: `It ensures that features with large numeric ranges do not dominate gradient descent or distance-based algorithms, leading to faster and more stable convergence`, wrongTexts: [`It removes outliers from the dataset`, `It converts categorical variables to numbers`, `It is only needed for neural networks`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What does a confusion matrix show in a Machine Learning classification task?`, correctText: `It shows the counts of True Positives, True Negatives, False Positives, and False Negatives, providing a detailed view of classification performance`, wrongTexts: [`It displays the model's weight parameters`, `It shows the training loss curve over epochs`, `It visualises the feature importance rankings`], topic: 'Machine Learning', category: 'Technical Skills' });
    }

    if (techLower === 'docker') {
      resumeTechPool.push({ questionText: `In Docker, what is the difference between a Docker image and a Docker container?`, correctText: `An image is a read-only template; a container is a running instance of that image`, wrongTexts: [`Images run code while containers store it`, `They are the same thing`, `Containers are stored on disk; images run in memory`], topic: 'Docker', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Docker, what is the purpose of a Dockerfile?`, correctText: `A text file with instructions that Docker uses to automatically build a container image layer by layer`, wrongTexts: [`A configuration file for Docker network routing`, `A script to install Docker on a server`, `A log file generated during container runtime`], topic: 'Docker', category: 'Technologies' });
    }

    if (techLower === 'rest api' || techLower === 'rest apis') {
      resumeTechPool.push({ questionText: `In REST API design, which HTTP method is explicitly defined as idempotent for updating or replacing an existing resource?`, correctText: `PUT`, wrongTexts: [`POST`, `GET`, `PATCH`], topic: 'REST APIs', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In REST API architecture, what does the term 'stateless' mean?`, correctText: `Each request from the client must contain all information needed to process it; the server does not store session state between requests`, wrongTexts: [`The server stores all client session data in memory`, `The API requires cookies on every request`, `Stateless means the API has no authentication`], topic: 'REST APIs', category: 'Technologies' });
    }
  }); // end resumeTechs.forEach

  // --- Project-based question pools ---
  const easyProject = project1 ? [
    { questionText: `In your resume project '${project1.name}', what is the core purpose and functionality of the system?`, correctText: `${project1.functionality || 'Providing user services, data tracking, and record management'}`, wrongTexts: [`Serving only static HTML documents`, `Compiling C++ binaries`, `Operating hardware sensors`], topic: project1.name, category: 'Projects' },
    { questionText: `Which main technology was used in building your resume project '${project1.name}'?`, correctText: `${(project1.technologies && project1.technologies[0]) || pickLang || pickFwork || 'The primary technology listed in the resume'}`, wrongTexts: [`Legacy Fortran compiler`, `Assembly language runtime`, `Hardcoded static HTML files`], topic: project1.name, category: 'Tech Stack Decisions' },
    { questionText: `What user role or development responsibility did you perform while working on '${project1.name}'?`, correctText: `${project1.role || 'Designing backend logic, UI components, and data integrations'}`, wrongTexts: [`Graphic logo designing only`, `Manual paper documentation printing`, `Hardware network cabling`], topic: project1.name, category: 'Projects' }
  ] : [];

  const mediumProject = project1 ? [
    { questionText: `In your resume project '${project1.name}', how does the system handle user input before processing it?`, correctText: `By applying validation checks and sanitisation before executing any business logic or data queries`, wrongTexts: [`Trusting all raw client string input without checking`, `Clearing database records on invalid input`, `Disabling HTTP error response codes`], topic: project1.name, category: 'Project Architecture' },
    { questionText: `When designing '${project1.name}', how did you structure data storage to avoid redundancy?`, correctText: `Using structured schemas with references or embedded sub-documents based on data access patterns`, wrongTexts: [`Storing all records in a single unformatted text file`, `Duplicating data across every user row`, `Disabling unique constraints`], topic: project1.name, category: 'Database Design' },
    { questionText: `In '${project1.name}', how does the client communicate with the backend service?`, correctText: `Via asynchronous HTTP fetch/axios requests to REST API endpoints`, wrongTexts: [`Using low-level UDP datagram packets`, `Through manual file downloads`, `Via browser cookies only`], topic: project1.name, category: 'API Communication' },
    { questionText: `What key technical challenge did you encounter during the development of '${project1.name}', and how was it solved?`, correctText: `Identifying and resolving a performance or logic issue through debugging, code review, and iterative testing`, wrongTexts: [`Bypassing security checks`, `Hardcoding temporary values in production`, `Ignoring system error trace logs`], topic: project1.name, category: 'Deployment & Challenges' }
  ] : [];

  const hardProject = project1 ? [
    { questionText: `In your resume project '${project1.name}', what security measure protects the system from unauthorised access?`, correctText: `Implementing authentication and authorisation checks (e.g., token-based auth, role checks) on sensitive routes`, wrongTexts: [`Storing plain-text passwords in localStorage`, `Disabling all error messages`, `Hardcoding admin credentials in source code`], topic: project1.name, category: 'Security & Auth' },
    { questionText: `If traffic on '${project1.name}' increased by 10x, what architectural optimisation would best prevent query bottlenecks?`, correctText: `Deploying an in-memory caching layer and optimising frequently queried data structures or indexes`, wrongTexts: [`Disabling database indexes`, `Increasing client polling rates`, `Compressing only static CSS files`], topic: project1.name, category: 'Project Architecture' },
    { questionText: `When deploying updates for '${project1.name}', how do you ensure backward compatibility with existing data?`, correctText: `Using backward-compatible schema migrations and staged deployment strategies`, wrongTexts: [`Dropping all production tables during peak traffic hours`, `Editing raw code files directly on live servers`, `Deleting all database backup snapshots`], topic: project1.name, category: 'Deployment & Challenges' }
  ] : [];

  // ================================================================
  // SELECT THE APPROPRIATE CANDIDATE POOL
  // ================================================================
  let candidatePool = [];

  if (modeType === 'Technical') {
    candidatePool = resumeTechPool;
  } else if (modeType === 'Project-based') {
    if (requestedDiff === 'Easy') candidatePool = easyProject;
    else if (requestedDiff === 'Hard') candidatePool = hardProject;
    else candidatePool = mediumProject.concat(easyProject);
  } else {
    // Mixed Mode
    if (isProjectCategory) {
      if (requestedDiff === 'Easy') candidatePool = easyProject;
      else if (requestedDiff === 'Hard') candidatePool = hardProject;
      else candidatePool = mediumProject.concat(easyProject);
    } else {
      candidatePool = resumeTechPool;
    }
  }

  // If no skill-specific questions could be built (e.g., zero skills in resume), use dynamic synthesis
  if (candidatePool.length === 0) {
    return generateDynamicSynthesizedQuestion(resumeData, { category: targetCategory, difficulty: requestedDiff }, nextIndex, forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4), usedQuestionTexts, modeType);
  }

  // ================================================================
  // FILTER OUT ALREADY-USED QUESTIONS
  // ================================================================
  const freshItems = candidatePool.filter(item => !isDuplicateQuestion(item.questionText, Array.from(usedQuestionTexts)));

  let rawItem = null;
  if (freshItems.length > 0) {
    rawItem = freshItems[nextIndex % freshItems.length];
  } else {
    // Pool exhausted — synthesise a fresh aspect from resume skills
    return generateDynamicSynthesizedQuestion(resumeData, { category: targetCategory, difficulty: requestedDiff }, nextIndex, forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4), usedQuestionTexts, modeType);
  }

  // ================================================================
  // BUILD MCQ ANSWER OPTIONS
  // ================================================================
  const targetPos = forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4);
  const wrongShuffled = shuffleArray(rawItem.wrongTexts || []);

  const finalChoiceTexts = [];
  let wrongIdx = 0;
  for (let p = 0; p < 4; p++) {
    if (p === targetPos) {
      finalChoiceTexts.push(rawItem.correctText);
    } else {
      finalChoiceTexts.push(wrongShuffled[wrongIdx++] || 'N/A');
    }
  }

  const options = finalChoiceTexts.map((text, i) => `${String.fromCharCode(65 + i)}) ${text}`);
  const correctAnswer = options[targetPos];

  return {
    questionText: rawItem.questionText,
    options,
    correctAnswer,
    correctOption: correctAnswer,
    topic: rawItem.topic || 'Technical',
    difficulty: requestedDiff,
    category: rawItem.category || targetCategory
  };
}
