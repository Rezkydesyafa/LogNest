export type ContainerLabels = Record<string, string | undefined>;

export function isLogmindEnabled(labels: ContainerLabels) {
  return labels['logmind.enabled'] === 'true';
}

export function isAgentContainer(containerId: string, labels: ContainerLabels, selfContainerId?: string) {
  return labels['logmind.agent'] === 'true' || Boolean(selfContainerId && containerId.startsWith(selfContainerId));
}

export function serviceNameFromLabels(labels: ContainerLabels, fallback: string) {
  return labels['logmind.service'] || fallback;
}

export function environmentFromLabels(labels: ContainerLabels) {
  return labels['logmind.environment'] || 'development';
}
