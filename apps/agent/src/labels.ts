export type ContainerLabels = Record<string, string | undefined>;

export function isLogmindEnabled(labels: ContainerLabels) {
  return labels['logmind.enabled'] === 'true';
}

export function shouldWatchContainer(
  labels: ContainerLabels,
  composeProjects: string[],
  composeServices: string[],
  excludedComposeProjects: string[] = [],
) {
  if (labels['logmind.enabled'] === 'false') return false;
  if (isLogmindEnabled(labels)) return true;

  const project = labels['com.docker.compose.project'];
  const service = labels['com.docker.compose.service'];
  const watchesAllProjects = composeProjects.includes('*');

  if (watchesAllProjects && project && excludedComposeProjects.includes(project)) return false;

  return Boolean(
    (watchesAllProjects || (project && composeProjects.includes(project))) &&
    (!composeServices.length || Boolean(service && composeServices.includes(service))),
  );
}

export function isAgentContainer(containerId: string, labels: ContainerLabels, selfContainerId?: string) {
  return (
    labels['logmind.agent'] === 'true' || Boolean(selfContainerId && containerId.startsWith(selfContainerId))
  );
}

export function serviceNameFromLabels(labels: ContainerLabels, fallback: string) {
  return labels['logmind.service'] || labels['com.docker.compose.service'] || fallback;
}

export function environmentFromLabels(labels: ContainerLabels, fallback = 'development') {
  return labels['logmind.environment'] || fallback;
}
