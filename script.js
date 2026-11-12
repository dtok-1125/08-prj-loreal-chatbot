/* Find the existing chat elements on the page. */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const starterSuggestions = document.getElementById("starterSuggestions");

// Add each message as text so user input is displayed safely.
function addMessage(message, sender, beforeElement = null) {
  const messageElement = document.createElement("p");
  messageElement.classList.add("msg", sender);
  messageElement.textContent = message;
  chatWindow.insertBefore(messageElement, beforeElement);
}

// Show the welcome message when the page loads.
addMessage("👋 Hello! How can I help you today?", "ai", starterSuggestions);

// Put a starter question in the input without submitting the form.
starterSuggestions.querySelectorAll(".starter-button").forEach((button) => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.question;
    userInput.focus();
  });
});

// Handle form submit.
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // When using Cloudflare, you'll need to POST a `messages` array in the body,
  // and handle the response using: data.choices[0].message.content

  // Show the visitor's message and the existing API setup reminder.
  chatWindow.replaceChildren();
  addMessage(userInput.value, "user");
  addMessage("Connect to the OpenAI API for a response!", "ai");
});
