/* Find the existing chat elements on the page. */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Add each message as text so user input is displayed safely.
function addMessage(message, sender) {
  const messageElement = document.createElement("p");
  messageElement.classList.add("msg", sender);
  messageElement.textContent = message;
  chatWindow.appendChild(messageElement);
}

// Show the welcome message when the page loads.
addMessage("👋 Hello! How can I help you today?", "ai");

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
