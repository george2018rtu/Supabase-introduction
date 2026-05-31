const supabaseUrl = "https://kgqpqqfgabfnbtxvsikh.supabase.co";
const supabaseKey = "sb_publishable_ZzXV8RQ1buL3WtmXkZ1FUg_ZeUPsrVk";
const client = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

window.onload = loadTasks;

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

    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description}</p>
      <button>Edit</button>
      <button>Delete</button>
    `;

    div.querySelectorAll("button")[0].onclick = () =>
      editTask(task.id, task.title, task.description);

    div.querySelectorAll("button")[1].onclick = () =>
      deleteTask(task.id);

    taskList.appendChild(div);
  });
}

async function addTask() {
  const title = document.getElementById("task-title").value;
  const description = document.getElementById("task-description").value;

  const { error } = await client
    .from("tasks")
    .insert([
      {
        title: title,
        description: description
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