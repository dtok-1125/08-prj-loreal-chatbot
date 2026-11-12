/* Find the chat elements on the page. */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const starterSuggestions = document.getElementById("starterSuggestions");
const sendButton = document.getElementById("sendBtn");
const startNewButton = document.getElementById("startNewBtn");

const workerUrl =
  "https://loreal-beauty-assistant.danielletokarz1125.workers.dev/";
const welcomeMessage = "👋 Hello! How can I help you today?";
const loadingMessages = [
  "✨ Finding a little inspiration for you...",
  "💄 Exploring your beauty possibilities...",
  "🌸 Personalizing your recommendations...",
  "✨ Putting the finishing touches on your advice...",
  "💛 Curating something just for you...",
];

const systemMessage = {
  role: "system",
  content:
    "You are a helpful beauty advisor for this L'Oréal-inspired chatbot. Help people explore beauty products and build routines with friendly, practical guidance. Always respond with a JSON object containing a conversational reply string in the 'reply' field. When you need more information to personalize your recommendation, include a 'choices' array with 2 to 4 short, relevant answer strings. When no clarification is needed, omit 'choices' or use an empty array.",
};

// Keep successful questions and answers so follow-up questions have context.
const conversationHistory = [systemMessage];
let activeChoices = null;
let loadingTimer = null;
let nextLoadingMessageIndex = 0;
let activeRequestController = null;
let activeRequestId = 0;

// Add a message as text so user input is displayed safely.
function addMessage(message, sender, beforeElement = null) {
  const messageElement = document.createElement("p");
  messageElement.classList.add("msg", sender);
  messageElement.textContent = message;
  chatWindow.insertBefore(messageElement, beforeElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageElement;
}

// Stop rotating the loading message and clear its timer.
function stopLoadingMessages() {
  if (loadingTimer !== null) {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

// Change the loading text every few seconds while the Worker responds.
function startLoadingMessages(messageElement) {
  // Start fresh so only one loading-message interval can run at a time.
  stopLoadingMessages();

  let messageIndex = nextLoadingMessageIndex;
  messageElement.textContent = loadingMessages[messageIndex];
  nextLoadingMessageIndex =
    (nextLoadingMessageIndex + 1) % loadingMessages.length;

  loadingTimer = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    messageElement.textContent = loadingMessages[messageIndex];
  }, 2500);
}

// Show optional answer buttons underneath an assistant reply.
function showChoices(choices) {
  const choiceGroup = document.createElement("div");
  choiceGroup.classList.add("follow-up-choices");
  choiceGroup.setAttribute("role", "group");
  choiceGroup.setAttribute("aria-label", "Suggested answers");

  choices.forEach((choice) => {
    const choiceButton = document.createElement("button");
    choiceButton.classList.add("follow-up-choice");
    choiceButton.type = "button";
    choiceButton.textContent = choice;
    choiceButton.addEventListener("click", () => {
      if (sendButton.disabled) {
        return;
      }

      // Send the selected answer as the visitor's next message.
      userInput.value = choice;
      chatForm.requestSubmit();
    });
    choiceGroup.appendChild(choiceButton);
  });

  chatWindow.appendChild(choiceGroup);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  activeChoices = choiceGroup;
}

// Reset the conversation without reloading the page.
function startNewConsultation() {
  activeRequestId += 1;
  stopLoadingMessages();

  // Cancel the previous request and ignore its response if it finishes later.
  if (activeRequestController) {
    activeRequestController.abort();
    activeRequestController = null;
  }

  sendButton.disabled = false;
  conversationHistory.splice(0, conversationHistory.length, systemMessage);
  activeChoices = null;
  userInput.value = "";

  chatWindow.replaceChildren();
  addMessage(welcomeMessage, "ai");
  chatWindow.appendChild(starterSuggestions);
  userInput.focus();
}

// Show the welcome message and the starter questions when the page loads.
addMessage(welcomeMessage, "ai", starterSuggestions);

// Starter buttons send their question using the same form submit behavior.
starterSuggestions.querySelectorAll(".starter-button").forEach((button) => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.question;
    chatForm.requestSubmit();
  });
});

startNewButton.addEventListener("click", startNewConsultation);

// Send the question to the Cloudflare Worker and show its response.
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (sendButton.disabled) {
    return;
  }

  const question = userInput.value.trim();
  if (!question) {
    return;
  }

  // Hide the starter questions and old answer choices after a new question.
  starterSuggestions.remove();
  if (activeChoices) {
    activeChoices.remove();
    activeChoices = null;
  }

  addMessage(question, "user");
  userInput.value = "";

  const loadingMessage = addMessage("", "ai");
  startLoadingMessages(loadingMessage);
  const userMessage = { role: "user", content: question };
  const requestId = ++activeRequestId;
  const requestController = new AbortController();
  activeRequestController = requestController;
  sendButton.disabled = true;

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [...conversationHistory, userMessage],
      }),
      signal: requestController.signal,
    });

    if (requestId !== activeRequestId) {
      return;
    }

    if (!response.ok) {
      throw new Error(`The Worker returned status ${response.status}.`);
    }

    const data = await response.json();
    if (requestId !== activeRequestId) {
      return;
    }

    const responseContent = data?.choices?.[0]?.message?.content;
    if (typeof responseContent !== "string" || !responseContent.trim()) {
      throw new Error("The Worker response did not contain a reply.");
    }

    // Read the reply and any optional choices from the JSON response.
    const structuredReply = JSON.parse(responseContent);
    const assistantReply = structuredReply.reply;
    if (typeof assistantReply !== "string" || !assistantReply.trim()) {
      throw new Error("The JSON response did not contain a conversational reply.");
    }

    // Stop the loading text and show the assistant's reply.
    stopLoadingMessages();
    loadingMessage.remove();
    addMessage(assistantReply, "ai");

    const choices = Array.isArray(structuredReply.choices)
      ? structuredReply.choices
          .filter((choice) => typeof choice === "string" && choice.trim())
          .slice(0, 4)
      : [];
    if (choices.length >= 2) {
      showChoices(choices);
    }

    // Save successful turns so the assistant understands follow-up questions.
    conversationHistory.push(userMessage, {
      role: "assistant",
      content: responseContent,
    });
  } catch (error) {
    if (requestId !== activeRequestId) {
      return;
    }

    console.error("Could not get a reply from the beauty assistant:", error);
    stopLoadingMessages();
    loadingMessage.remove();
    addMessage(
      "I'm sorry, I couldn't connect right now. Please try again in a moment.",
      "ai",
    );
  } finally {
    if (requestId === activeRequestId) {
      stopLoadingMessages();
      activeRequestController = null;
      sendButton.disabled = false;
    }
  }
});
