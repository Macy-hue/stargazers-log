const repositoryList = document.querySelector("#repository-list");
const statusMessage = document.querySelector("#status");

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function renderRepositories(repositories) {
  repositoryList.replaceChildren();

  for (const repository of repositories) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const description = document.createElement("p");
    const date = document.createElement("time");

    link.className = "repository-name";
    link.href = repository.url;
    link.textContent = repository.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    description.className = "repository-description";
    description.textContent = repository.description;

    date.className = "repository-date";
    date.dateTime = repository.starredAt;
    date.textContent = `Starred on ${formatDate(repository.starredAt)}`;

    item.append(link, description, date);
    repositoryList.append(item);
  }

  statusMessage.textContent = repositories.length
    ? ""
    : "No starred repositories yet.";
}

async function loadRepositories() {
  try {
    const response = await fetch("events.json");

    if (!response.ok) {
      throw new Error(`Could not load repositories (${response.status}).`);
    }

    const repositories = await response.json();
    renderRepositories(repositories);
  } catch (error) {
    statusMessage.textContent = "Unable to load starred repositories. Please try again later.";
    console.error("Failed to load starred repositories:", error);
  }
}

loadRepositories();
