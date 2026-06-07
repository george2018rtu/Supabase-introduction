const supabaseUrl = "https://kgqpqqfgabfnbtxvsikh.supabase.co";
const supabaseKey = "sb_publishable_ZzXV8RQ1buL3WtmXkZ1FUg_ZeUPsrVk";

const client = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentTaskId = null;
let currentUserId = null;
let currentUserName = null;
let messageChannel = null;
let currentUserRole = null;
let shownMessageIds = new Set();

window.onload = checkLogin;

function checkLogin() {
  const savedUser = localStorage.getItem("currentUser");

  if (savedUser) {
    const user = JSON.parse(savedUser);
    currentUserId = user.id;
    currentUserName = user.name;
    currentUserRole = user.role;

    showApp();
  }
}

function showApp() {
  document.getElementById("auth-page").style.display = "none";
  document.getElementById("app-page").style.display = "block";
  document.getElementById("current-user").textContent =
    "Logged in as: " + currentUserName;

  if (currentUserRole === "authenticator") {
    document.getElementById("task-title").style.display = "inline-block";
    document.getElementById("task-description").style.display = "inline-block";
    document.querySelector('button[onclick="addTask()"]').style.display = "inline-block";
  } else {
    document.getElementById("task-title").style.display = "none";
    document.getElementById("task-description").style.display = "none";
    document.querySelector('button[onclick="addTask()"]').style.display = "none";
  }

  loadTasks();
}

async function signUp() {
  const name = document.getElementById("auth-name").value.trim();
  const email = document.getElementById("auth-email").value.trim();

  if (name === "" || email === "") {
    alert("Enter name and email.");
    return;
  }

  const { data, error } = await client
    .from("users")
    .insert([
      {
        name: name,
        email: email,
        role: "student"
      }
    ])
    .select();

  if (error) {
    console.log(error);
    alert("Signup failed.");
    return;
  }

  const user = data[0];

  currentUserId = user.id;
  currentUserName = user.name;
  currentUserRole = user.role;

  localStorage.setItem("currentUser", JSON.stringify(user));

  showApp();
}

async function logIn() {
  const email = document.getElementById("login-email").value.trim();

  if (email === "") {
    alert("Enter email.");
    return;
  }

  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) {
    console.log(error);
    alert("User not found.");
    return;
  }

  currentUserId = data.id;
  currentUserName = data.name;
  currentUserRole = data.role;

  localStorage.setItem("currentUser", JSON.stringify(data));

  showApp();
}

function logOut() {
  localStorage.removeItem("currentUser");
  closeChat();

  currentUserId = null;
  currentUserName = null;
  currentUserRole = null;
  currentTaskId = null;
  

  document.getElementById("auth-page").style.display = "block";
  document.getElementById("app-page").style.display = "none";
}

async function loadTasks() {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  const taskList = document.getElementById("task-list");
  taskList.innerHTML = "";

  data.forEach(task => {
    const div = document.createElement("div");
    div.className = "task-card";

    let buttons = "";

    if (currentUserRole === "authenticator") {
      buttons = `
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
        <button class="chat-btn">Chat</button>
        <button class="applications-btn">Applications</button>
        
      `;
    } else {
      buttons = `
        <button class="join-btn">Request to join</button>
        <button class="chat-btn">Chat</button>
      `;
    }

    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description}</p>
      <div id="managers-${task.id}" class="manager-list"></div>
      <div id="members-${task.id}" class="members-list"></div>
      ${buttons}
    `;

    if (currentUserRole === "authenticator") {
      div.querySelector(".edit-btn").onclick = () =>
        editTask(task.id, task.title, task.description);

      div.querySelector(".delete-btn").onclick = () =>
        deleteTask(task.id);

      div.querySelector(".applications-btn").onclick = () =>
        viewApplications(task.id);
    } else {
      div.querySelector(".join-btn").onclick = () =>
        joinTask(task.id);
    }

    div.querySelector(".chat-btn").onclick = () =>
      openChat(task.id, task.title, task.authenticator_id);

    taskList.appendChild(div);
    loadMembers(task.id);
    loadManagers(task.id);
  });
}

async function addTask() {
  const title = document.getElementById("task-title").value.trim();
  const description = document.getElementById("task-description").value.trim();

  if (title === "" || description === "") {
    alert("Fill in both title and description.");
    return;
  }
  if (currentUserRole !== "authenticator") {
    alert("Only authenticators can create tasks.");
    return;
  }

  const { error } = await client
  .from("tasks")
  .insert([
    {
      title: title,
      description: description,
      authenticator_id: currentUserId
    }
  ]);

  if (error) {
    console.log(error);
    return;
  }

  document.getElementById("task-title").value = "";
  document.getElementById("task-description").value = "";

  loadTasks();
}

async function deleteTask(id) {
  const { error } = await client
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.log(error);
    return;
  }

  if (currentTaskId === id) closeChat();

  loadTasks();
}

async function editTask(id, oldTitle, oldDescription) {
  const newTitle = prompt("Edit title:", oldTitle);
  const newDescription = prompt("Edit description:", oldDescription);

  if (newTitle === null || newDescription === null) return;

  const { error } = await client
    .from("tasks")
    .update({
      title: newTitle,
      description: newDescription
    })
    .eq("id", id);

  if (error) {
    console.log(error);
    return;
  }

  loadTasks();
}

async function openChat(taskId, taskTitle, authenticatorId) {
  const isAuthenticator = currentUserRole === "authenticator";

  const { data } = await client
    .from("task_registrations")
    .select("*")
    .eq("task_id", taskId)
    .eq("user_id", currentUserId);

  const hasJoined =
  data && data.length > 0 && data[0].status === "accepted";

  if (!isAuthenticator && !hasJoined) {
    alert("Join this task before opening the chat.");
    return;
  }

  currentTaskId = taskId;
  shownMessageIds.clear();

  document.getElementById("chat-box").style.display = "block";
  document.getElementById("chat-title").textContent = taskTitle;

  await loadMessages();

  if (messageChannel) {
    await client.removeChannel(messageChannel);
    messageChannel = null;
  }

  messageChannel = client
    .channel("task-chat-" + taskId)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "task_messages",
        filter: `task_id=eq.${taskId}`
      },
      async (payload) => {
        await addMessageToScreen(payload.new);
      }
    )
    .subscribe();
}
async function loadMessages() {
  if (currentTaskId === null) return;

  const { data, error } = await client
    .from("task_messages")
    .select("*")
    .eq("task_id", currentTaskId)
    .order("id", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";
  shownMessageIds.clear();
  lastMessageTime = null;

  for (const msg of data) {
    await addMessageToScreen(msg);
  }

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage() {
  if (currentTaskId === null) {
    alert("Open a chat first.");
    return;
  }

  const input = document.getElementById("message-input");
  const message = input.value.trim();

  if (message === "") return;

  input.value = "";

  const { error } = await client
    .from("task_messages")
    .insert([
      {
        task_id: currentTaskId,
        user_id: currentUserId,
        message: message
      }
    ]);

  if (error) {
    console.log(error);
    alert("Message failed to send.");
  }
}

async function closeChat() {
  if (messageChannel) {
    await client.removeChannel(messageChannel);
    messageChannel = null;
  }

  currentTaskId = null;
  shownMessageIds.clear();

  document.getElementById("chat-box").style.display = "none";
  document.getElementById("chat-title").textContent = "Chat";
  document.getElementById("messages").innerHTML = "";
  document.getElementById("message-input").value = "";
}

async function addMessageToScreen(msg) {
  if (shownMessageIds.has(msg.id)) return;

  shownMessageIds.add(msg.id);

  let senderName = "Unknown";

  const { data: userData } = await client
    .from("users")
    .select("name")
    .eq("id", msg.user_id)
    .single();

  if (userData) {
    senderName = userData.name;
  }

  const messagesDiv = document.getElementById("messages");

  const currentDate = new Date(msg.created_at);

  let showTime = false;

  if (!lastMessageTime) {
    showTime = true;
  } else {
    const diffMinutes = (currentDate - lastMessageTime) / 1000 / 60;

    if (diffMinutes >= 10) {
      showTime = true;
    }
  }

  if (showTime) {
    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";

    timeDiv.textContent = currentDate.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });

    messagesDiv.appendChild(timeDiv);
  }

  const row = document.createElement("div");

  const isMe = msg.user_id === currentUserId;

  row.className = isMe ? "message-row my-row" : "message-row other-row";

  const initials = senderName
    .split(" ")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatar = `
    <div class="message-avatar">${initials}</div>
  `;

  const bubble = `
    <div class="message-bubble ${isMe ? "my-bubble" : "other-bubble"}">
      <div class="message-name">${senderName}</div>
      <div class="message-text">${msg.message}</div>
    </div>
  `;

  row.innerHTML = isMe ? bubble + avatar : avatar + bubble;

  messagesDiv.appendChild(row);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  lastMessageTime = currentDate;
}

async function joinTask(taskId) {
  console.log("Applying with:", {
    task_id: taskId,
    user_id: currentUserId
  });

  const { error } = await client
    .from("task_registrations")
    .insert([
      {
        task_id: taskId,
        user_id: currentUserId,
        status: "pending"
      }
    ]);

  if (error) {
    console.log("Apply error:", error);

    if (error.code === "23505") {
      alert("You already applied for this task.");
    } else {
      alert("Application failed: " + error.message);
    }

    return;
  }

  alert("Application sent!");
  loadTasks();
}

async function loadMembers(taskId) {
  const { data, error } = await client
    .from("task_registrations")
    .select("*")
    .eq("task_id", taskId);

  if (error) {
    console.log(error);
    return;
  }

  const membersDiv = document.getElementById("members-" + taskId);
  if (!membersDiv) return;

  if (data.length === 0) {
    membersDiv.innerHTML = `<strong>Students:</strong> No applications yet`;
    return;
  }

  let lines = [];

  for (const reg of data) {
    const { data: userData } = await client
      .from("users")
      .select("name")
      .eq("id", reg.user_id)
      .single();

    if (userData) {
      lines.push(`${userData.name} (${reg.status})`);
    }
  }

  membersDiv.innerHTML = `<strong>Students:</strong> ${lines.join(", ")}`;
}

async function deleteTask(id) {

  await client
    .from("task_messages")
    .delete()
    .eq("task_id", id);

  await client
    .from("task_registrations")
    .delete()
    .eq("task_id", id);

  const { error } = await client
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.log(error);
    return;
  }

  loadTasks();
}

async function loadManagers(taskId) {
  const { data, error } = await client
    .from("users")
    .select("name")
    .eq("role", "authenticator");

  if (error) {
    console.log(error);
    return;
  }

  const div = document.getElementById("managers-" + taskId);
  if (!div) return;

  const names = data.map(user => user.name);

  div.innerHTML = `<strong>Managers:</strong> ${names.join(", ")}`;
}
async function viewApplications(taskId) {
  const { data, error } = await client
    .from("task_registrations")
    .select("*")
    .eq("task_id", taskId);

  if (error) {
    console.log(error);
    return;
  }

  if (data.length === 0) {
    alert("No applications yet.");
    return;
  }

  let text = "Applications:\n\n";

  for (const reg of data) {
    const { data: userData } = await client
      .from("users")
      .select("name")
      .eq("id", reg.user_id)
      .single();

    text += `${reg.id}: ${userData ? userData.name : "Unknown"} - ${reg.status}\n`;
  }

  const applicationId = prompt(text + "\nEnter the application ID:");

  if (!applicationId) return;

  const decision = prompt("Type accepted or rejected:");
  const cleanDecision = decision.trim().toLowerCase();

  if (cleanDecision !== "accepted" && cleanDecision !== "rejected") {
    alert("Type exactly: accepted or rejected");
    return;
  }

  const cleanId = Number(applicationId);

  const { data: updatedData, error: updateError } = await client
    .from("task_registrations")
    .update({ status: cleanDecision })
    .eq("id", cleanId)
    .select();

  if (updateError) {
    console.log("Update error:", updateError);
    alert("Update failed: " + updateError.message);
    return;
  }

  console.log("Updated application:", updatedData);

  if (!updatedData || updatedData.length === 0) {
    alert("No application was updated. Check the ID.");
    return;
  }

  alert("Application updated.");
  loadTasks();
}