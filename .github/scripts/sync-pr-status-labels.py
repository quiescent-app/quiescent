#!/usr/bin/env python3
"""Synchronize the four PR status labels with GitHub's current merge state."""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


STATUS_LABELS = {
    "Failed": ("b60205", "A required check has failed."),
    "Conflicts": ("d93f0b", "The pull request has merge conflicts."),
    "Need Reviews": ("fbca04", "Required reviews are still outstanding."),
    "Ready to merge": ("0e8a16", "Required reviews and checks are satisfied; no conflicts remain."),
}
ACCEPTED_CHECK_CONCLUSIONS = {"SUCCESS", "SKIPPED", "NEUTRAL"}
FAILED_CHECK_CONCLUSIONS = {"FAILURE", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED"}


class GitHubAPIError(RuntimeError):
    pass


def api_request(path, method="GET", body=None):
    api_url = os.environ["GITHUB_API_URL"].rstrip("/")
    url = path if path.startswith("https://") else f"{api_url}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status == 204:
                return None
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise GitHubAPIError(f"GitHub API {method} {url} returned {error.code}: {details}") from error


def paginated_api(path):
    page = 1
    while True:
        separator = "&" if "?" in path else "?"
        rows = api_request(f"{path}{separator}per_page=100&page={page}")
        if not rows:
            return
        yield from rows
        if len(rows) < 100:
            return
        page += 1


def graphql(query, variables):
    response = api_request(
        f"{os.environ['GITHUB_API_URL'].rstrip('/')}/graphql",
        method="POST",
        body={"query": query, "variables": variables},
    )
    if response.get("errors"):
        raise GitHubAPIError("GitHub GraphQL error: " + json.dumps(response["errors"]))
    return response["data"]


PR_QUERY = """
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
      number
      state
      mergeable
      mergeStateStatus
      reviewDecision
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100, after: $cursor) {
                nodes {
                  __typename
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    isRequired(pullRequestNumber: $number)
                  }
                  ... on StatusContext {
                    context
                    state
                    isRequired(pullRequestNumber: $number)
                  }
                }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }
      }
    }
  }
}
"""


def get_pull_request(owner, name, number):
    contexts = []
    cursor = None
    while True:
        data = graphql(
            PR_QUERY,
            {"owner": owner, "name": name, "number": number, "cursor": cursor},
        )
        pull_request = data["repository"]["pullRequest"]
        if pull_request is None:
            return None
        commits = pull_request["commits"]["nodes"]
        rollup = commits[-1]["commit"]["statusCheckRollup"] if commits else None
        if rollup is None:
            break
        page = rollup["contexts"]
        contexts.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
    pull_request["checkContexts"] = contexts
    return pull_request


def failed_required_check(context):
    if not context.get("isRequired"):
        return False
    if context["__typename"] == "CheckRun":
        return context.get("conclusion") in FAILED_CHECK_CONCLUSIONS
    return context.get("state") == "ERROR"


def required_checks_succeeded(contexts):
    for context in contexts:
        if not context.get("isRequired"):
            continue
        if context["__typename"] == "CheckRun":
            if context.get("status") != "COMPLETED" or context.get("conclusion") not in ACCEPTED_CHECK_CONCLUSIONS:
                return False
        elif context.get("state") != "SUCCESS":
            return False
    return True


def determine_label(pull_request):
    if pull_request["state"] != "OPEN":
        return None

    contexts = pull_request["checkContexts"]
    if any(failed_required_check(context) for context in contexts):
        return "Failed"

    if pull_request["mergeable"] == "CONFLICTING" or pull_request["mergeStateStatus"] == "DIRTY":
        return "Conflicts"

    if pull_request["reviewDecision"] in {"REVIEW_REQUIRED", "CHANGES_REQUESTED"}:
        return "Need Reviews"

    checks_ready = required_checks_succeeded(contexts)
    reviews_ready = pull_request["reviewDecision"] in {None, "APPROVED"}
    merge_state_ready = pull_request["mergeable"] == "MERGEABLE" and pull_request["mergeStateStatus"] == "CLEAN"
    if checks_ready and reviews_ready and merge_state_ready:
        return "Ready to merge"

    # Pending or unknown states have no matching status label yet. Clearing
    # stale labels prevents a prior state from being presented as current.
    return None


def ensure_labels(repository):
    for name, (color, description) in STATUS_LABELS.items():
        encoded_name = urllib.parse.quote(name, safe="")
        try:
            api_request(f"/repos/{repository}/labels/{encoded_name}")
        except GitHubAPIError as error:
            if "returned 404:" not in str(error):
                raise
            try:
                api_request(
                    f"/repos/{repository}/labels",
                    method="POST",
                    body={"name": name, "color": color, "description": description},
                )
            except GitHubAPIError as create_error:
                # A parallel workflow may have created the label after our GET.
                if "returned 422:" not in str(create_error):
                    raise
                api_request(f"/repos/{repository}/labels/{encoded_name}")


def synchronize_one(repository, owner, name, number):
    pull_request = get_pull_request(owner, name, number)
    if pull_request is None:
        print(f"PR #{number} no longer exists; skipping")
        return

    desired = determine_label(pull_request)
    current = list(paginated_api(f"/repos/{repository}/issues/{number}/labels"))
    current_status_labels = {label["name"] for label in current} & STATUS_LABELS.keys()
    remove = sorted(current_status_labels - ({desired} if desired else set()))
    for label in remove:
        api_request(
            f"/repos/{repository}/issues/{number}/labels/{urllib.parse.quote(label, safe='')}",
            method="DELETE",
        )

    if desired and desired not in current_status_labels:
        api_request(
            f"/repos/{repository}/issues/{number}/labels",
            method="POST",
            body={"labels": [desired]},
        )
    print(f"PR #{number}: {desired or 'no settled status'}")


def pull_request_numbers_from_event(event, repository):
    payload = json.load(open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8"))
    pull_request = payload.get("pull_request")
    if pull_request and "number" in pull_request:
        return [pull_request["number"]]
    if payload.get("number"):
        return [payload["number"]]

    sha = (
        payload.get("check_run", {}).get("head_sha")
        or payload.get("check_suite", {}).get("head_sha")
        or payload.get("sha")
    )
    if not sha:
        print(f"Event {event} did not include a PR number or commit SHA; nothing to update")
        return []

    return sorted(
        {
            item["number"]
            for item in paginated_api(f"/repos/{repository}/commits/{sha}/pulls")
            if item.get("state") == "open"
        }
    )


def main():
    repository = os.environ["GITHUB_REPOSITORY"]
    owner, name = repository.split("/", 1)
    event = os.environ.get("GITHUB_EVENT_NAME", "")
    numbers = pull_request_numbers_from_event(event, repository)
    if not numbers:
        return

    ensure_labels(repository)
    for number in numbers:
        synchronize_one(repository, owner, name, number)


if __name__ == "__main__":
    try:
        main()
    except (GitHubAPIError, KeyError, IndexError, TypeError) as error:
        print(f"PR status label synchronization failed: {error}", file=sys.stderr)
        sys.exit(1)
