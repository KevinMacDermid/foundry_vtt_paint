Hooks.once("ready", () => {
  console.log("Foundry Paint | Module loaded successfully!");

  // Add a simple floating button to the UI
  const btn = document.createElement("button");
  btn.id = "foundry-paint-btn";
  btn.innerHTML = '<i class="fas fa-palette"></i> Paint';
  btn.addEventListener("click", () => {
    ui.notifications.info("Foundry Paint is working!");
  });
  document.body.appendChild(btn);
});
