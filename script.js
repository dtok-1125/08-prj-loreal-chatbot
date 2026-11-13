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
const closingMessage =
  "Great! ✨ It was a pleasure helping you today. Remember, beauty is all about what makes you feel confident. Have a beautiful day!";
const loadingMessages = [
  "✨ Finding a little inspiration for you...",
  "💄 Exploring your beauty possibilities...",
  "🌸 Personalizing your recommendations...",
  "💛 Curating something just for you...",
];
const finishingMessage = "✨ Putting the finishing touches on your advice...";

const systemMessage = {
  role: "system",
  content:
    "You are a personal beauty advisor for this L'Oréal-inspired chatbot. Stay focused on skincare and skincare routines, haircare and styling, makeup and cosmetics, fragrances, L'Oréal Paris products, and beauty consultations. " +
    "If a question is unrelated to beauty, do not answer it. Warmly redirect the conversation to beauty, for example: \"I'm here to help you discover beauty routines and L'Oréal Paris products that work for you! Let's get back to your beauty journey. What can I help you explore today?\" " +
    "If a question has a genuine beauty connection, answer the beauty-related part and do not get sidetracked by unrelated details. " +
    "Be accurate and transparent. Do not invent product details, promotions, prices, availability, or rewards-program information. If you cannot verify a detail, say so and suggest checking the official L'Oréal Paris website. " +
    "Always respond with a JSON object containing a conversational reply string in the 'reply' field and a 'choices' array. After useful beauty advice or a redirect, include 2 or 3 short follow-up choices that stay within skincare, haircare, makeup, or fragrance. For an unrelated question, make every follow-up choice about returning to one of those beauty topics. Include a final choice exactly phrased 'No thanks, that's all!'. Do not include choices after a closing message. Keep the reply warm and helpful, and do not say 'You're welcome' unless the customer has thanked you.",
};

// Keep successful questions and answers so follow-up questions have context.
const conversationHistory = [systemMessage];
let activeChoices = null;
let loadingTimer = null;
let nextLoadingMessageIndex = 0;
let activeRequestController = null;
let activeRequestId = 0;
let consultationEnded = false;

// Add a message as text so user input is displayed safely.
function addMessage(message, sender, beforeElement = null) {
  const messageElement = document.createElement("p");
  messageElement.classList.add("msg", sender);
  messageElement.textContent = message;
  chatWindow.insertBefore(messageElement, beforeElement);
  return messageElement;
}

// Scroll only the chat window until the given message reaches its top edge.
function scrollChatToMessage(messageElement) {
  const messageTop = messageElement.getBoundingClientRect().top;
  const chatTop = chatWindow.getBoundingClientRect().top;
  chatWindow.scrollTop += messageTop - chatTop;
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
  let messagesShown = 1;
  messageElement.textContent = loadingMessages[messageIndex];
  nextLoadingMessageIndex =
    (nextLoadingMessageIndex + 1) % loadingMessages.length;

  loadingTimer = setInterval(() => {
    // Show the finishing message only after each rotating message has appeared.
    if (messagesShown === loadingMessages.length) {
      messageElement.textContent = finishingMessage;
      stopLoadingMessages();
      return;
    }

    messageIndex = (messageIndex + 1) % loadingMessages.length;
    messageElement.textContent = loadingMessages[messageIndex];
    messagesShown += 1;
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
  activeChoices = choiceGroup;
}

// Find the last assistant reply so a short "No" can be understood in context.
function getLastAssistantReply() {
  const lastAssistantMessage = [...conversationHistory]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage) {
    return "";
  }

  try {
    return JSON.parse(lastAssistantMessage.content).reply || "";
  } catch {
    return lastAssistantMessage.content;
  }
}

// Recognize complete closing phrases without matching unrelated questions.
function isClosingResponse(message) {
  const normalizedMessage = message
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const withoutPoliteEnding = normalizedMessage.replace(
    /\s+(thanks|thank you)$/,
    "",
  );

  const closingPhrases = [
    "no thats all",
    "no thats all for now",
    "thats all",
    "thats all for now",
    "im all set",
    "im all set for now",
    "no im all set",
    "no im all set for now",
    "no im good",
    "no im good for now",
    "no thanks",
    "no thanks thats all",
    "no thank you",
    "no thats it",
    "no thats it for now",
    "thats everything",
    "thats everything for now",
    "no thats everything",
    "nothing else",
    "nothing else for now",
    "thats it",
    "thats it for now",
    "all done",
    "all done for now",
    "im good",
    "im good for now",
    "im done",
    "im done for now",
    "im finished",
    "im finished for now",
    "that will be all",
    "thatll be all",
    "no more questions",
    "nope thats all",
    "nope im all set",
  ];

  if (
    closingPhrases.includes(normalizedMessage) ||
    closingPhrases.includes(withoutPoliteEnding)
  ) {
    return true;
  }

  // A brief "No" is a closing only when the assistant asked if more help is needed.
  const assistantReply = getLastAssistantReply();
  const assistantAskedIfMoreIsNeeded =
    /\b(anything else|anything more|need anything else|need anything more|more questions|more help|can i help with anything else|would you like .* help)\b/i.test(
      assistantReply,
    );

  return (
    assistantAskedIfMoreIsNeeded &&
    ["no", "nope", "no thanks", "no thank you"].includes(normalizedMessage)
  );
}

// Do not offer more choices when the assistant has already said goodbye.
function isAssistantClosingReply(message) {
  return (
    message.trim() === closingMessage ||
    /\b(it was a pleasure helping you|have a beautiful day|thanks for chatting|goodbye|take care)\b[.!✨\s]*$/i.test(
      message.trim(),
    )
  );
}

// Keep a couple of useful choices available even if the Worker omits them.
function getFollowUpChoices(suggestedChoices) {
  const choices = [
    ...new Set(suggestedChoices.filter((choice) => !isClosingResponse(choice))),
  ];
  const fallbackChoices = [
    "Can you suggest a skincare routine for me?",
    "What makeup, haircare, or fragrance tips do you recommend?",
  ];

  fallbackChoices.forEach((choice) => {
    if (choices.length < 2 && !choices.includes(choice)) {
      choices.push(choice);
    }
  });

  const closingChoice =
    suggestedChoices.find((choice) => isClosingResponse(choice)) ||
    "No thanks, that's all!";

  return [...choices.slice(0, 3), closingChoice];
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
  userInput.disabled = false;
  consultationEnded = false;
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

  if (sendButton.disabled || consultationEnded) {
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

  // End the consultation locally without sending a closing response to the Worker.
  if (isClosingResponse(question)) {
    consultationEnded = true;
    userInput.disabled = true;
    sendButton.disabled = true;
    const goodbyeBubble = addMessage(closingMessage, "ai");
    scrollChatToMessage(goodbyeBubble);
    conversationHistory.push(
      { role: "user", content: question },
      {
        role: "assistant",
        content: JSON.stringify({ reply: closingMessage }),
      },
    );
    return;
  }

  const loadingMessage = addMessage("", "ai");
  startLoadingMessages(loadingMessage);
  scrollChatToMessage(loadingMessage);
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
    const replyBubble = addMessage(assistantReply, "ai");

    const suggestedChoices = Array.isArray(structuredReply.choices)
      ? structuredReply.choices
          .filter((choice) => typeof choice === "string" && choice.trim())
      : [];

    if (!isAssistantClosingReply(assistantReply)) {
      showChoices(getFollowUpChoices(suggestedChoices));
    }

    // Keep the start of the reply in view instead of jumping to its choices.
    scrollChatToMessage(replyBubble);

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
    const errorBubble = addMessage(
      "I'm sorry, I couldn't connect right now. Please try again in a moment.",
      "ai",
    );
    scrollChatToMessage(errorBubble);
  } finally {
    if (requestId === activeRequestId) {
      stopLoadingMessages();
      activeRequestController = null;
      sendButton.disabled = false;
    }
  }
});
