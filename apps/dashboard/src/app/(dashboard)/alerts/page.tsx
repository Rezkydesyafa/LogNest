'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, PlusIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatDate } from '@/lib/api';
import type { AlertChannel, AlertDelivery, AlertRule } from '@/lib/types';
import { ErrorState, PageHeader, PageLoading, ProjectRequired } from '@/components/page-state';
import { deniedReason } from '@/lib/permissions';
import { useProject } from '@/components/project-context';
import { StatusBadge } from '@/components/status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Which config fields each channel type needs, so the form asks for the right secrets. */
const CHANNEL_FIELDS: Record<string, Array<{ name: string; label: string; placeholder: string }>> = {
  SLACK: [{ name: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/…' }],
  DISCORD: [{ name: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/…' }],
  TELEGRAM: [
    { name: 'botToken', label: 'Bot token', placeholder: '123456:ABC-DEF…' },
    { name: 'chatId', label: 'Chat id', placeholder: '-1001234567890' },
  ],
  WEBHOOK: [{ name: 'url', label: 'Endpoint URL', placeholder: 'https://ops.example.com/logmind' }],
};

export default function AlertsPage() {
  const { projectId, loading, can } = useProject();
  const mayManage = can('manageAlerts');
  const client = useQueryClient();
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelType, setChannelType] = useState('SLACK');
  const [ruleOpen, setRuleOpen] = useState(false);

  const channels = useQuery({
    queryKey: ['alert-channels', projectId],
    queryFn: () => api<AlertChannel[]>(`/projects/${projectId}/alert-channels`),
    enabled: Boolean(projectId),
  });
  const rules = useQuery({
    queryKey: ['alert-rules', projectId],
    queryFn: () => api<AlertRule[]>(`/projects/${projectId}/alert-rules`),
    enabled: Boolean(projectId),
  });
  const deliveries = useQuery({
    queryKey: ['alert-deliveries', projectId],
    queryFn: () => api<AlertDelivery[]>(`/projects/${projectId}/alert-deliveries`),
    enabled: Boolean(projectId),
  });

  const refresh = async (key: string) => {
    await client.invalidateQueries({ queryKey: [key, projectId] });
  };

  const createChannel = useMutation({
    mutationFn: (input: { name: string; type: string; config: Record<string, string> }) =>
      api<AlertChannel>(`/projects/${projectId}/alert-channels`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setChannelOpen(false);
      await refresh('alert-channels');
      toast.success('Channel created');
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteChannel = useMutation({
    mutationFn: (id: string) => api(`/alert-channels/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([refresh('alert-channels'), refresh('alert-rules')]);
      toast.success('Channel deleted');
    },
    onError: (error) => toast.error(error.message),
  });
  const testChannel = useMutation({
    mutationFn: (id: string) =>
      api<{ delivered: boolean; error?: string }>(`/alert-channels/${id}/test`, { method: 'POST' }),
    onSuccess: (result) =>
      result.delivered
        ? toast.success('Test alert delivered')
        : toast.error(result.error ?? 'Test alert failed'),
    onError: (error) => toast.error(error.message),
  });
  const createRule = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<AlertRule>(`/projects/${projectId}/alert-rules`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setRuleOpen(false);
      await refresh('alert-rules');
      toast.success('Rule created');
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteRule = useMutation({
    mutationFn: (id: string) => api(`/alert-rules/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await refresh('alert-rules');
      toast.success('Rule deleted');
    },
    onError: (error) => toast.error(error.message),
  });

  if (loading) return <PageLoading />;
  if (!projectId) return <ProjectRequired />;
  if (channels.error) return <ErrorState error={channels.error} />;

  const channelDialog = (
    <Dialog open={channelOpen} onOpenChange={setChannelOpen}>
      <DialogTrigger asChild>
        <Button disabled={!mayManage} title={mayManage ? undefined : deniedReason('manageAlerts')}>
          <PlusIcon data-icon="inline-start" />
          Add channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const config: Record<string, string> = {};
            for (const field of CHANNEL_FIELDS[channelType]) {
              config[field.name] = String(data.get(field.name) ?? '');
            }
            createChannel.mutate({ name: String(data.get('name')), type: channelType, config });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add notification channel</DialogTitle>
            <DialogDescription>
              Secrets are stored server-side and never returned by the API again.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            <Field>
              <FieldLabel htmlFor="channel-name">Name</FieldLabel>
              <Input id="channel-name" name="name" required minLength={2} />
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select value={channelType} onValueChange={setChannelType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="SLACK">Slack</SelectItem>
                    <SelectItem value="DISCORD">Discord</SelectItem>
                    <SelectItem value="TELEGRAM">Telegram</SelectItem>
                    <SelectItem value="WEBHOOK">Webhook</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {CHANNEL_FIELDS[channelType].map((field) => (
              <Field key={field.name}>
                <FieldLabel htmlFor={`channel-${field.name}`}>{field.label}</FieldLabel>
                <Input
                  id={`channel-${field.name}`}
                  name={field.name}
                  placeholder={field.placeholder}
                  required
                />
              </Field>
            ))}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={createChannel.isPending}>
              {createChannel.isPending && <Spinner data-icon="inline-start" />}Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  const ruleDialog = (
    <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={!mayManage || !channels.data?.length}
          title={mayManage ? undefined : deniedReason('manageAlerts')}
        >
          <PlusIcon data-icon="inline-start" />
          Add rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            createRule.mutate({
              name: String(data.get('name')),
              channelId: String(data.get('channelId')),
              minSeverity: String(data.get('minSeverity')),
              throttleMinutes: Number(data.get('throttleMinutes')),
              environments: String(data.get('environments') ?? '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add alert rule</DialogTitle>
            <DialogDescription>Alerts fire when an incident opens, escalates, or reopens.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            <Field>
              <FieldLabel htmlFor="rule-name">Name</FieldLabel>
              <Input id="rule-name" name="name" required minLength={2} />
            </Field>
            <Field>
              <FieldLabel>Channel</FieldLabel>
              <Select name="channelId" defaultValue={channels.data?.[0]?.id}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(channels.data ?? []).map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name} ({channel.type})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Minimum severity</FieldLabel>
              <Select name="minSeverity" defaultValue="HIGH">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-environments">Environments</FieldLabel>
              <Input id="rule-environments" name="environments" placeholder="production, staging" />
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-throttle">Throttle (minutes)</FieldLabel>
              <Input
                id="rule-throttle"
                name="throttleMinutes"
                type="number"
                min={0}
                max={1440}
                defaultValue={30}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={createRule.isPending}>
              {createRule.isPending && <Spinner data-icon="inline-start" />}Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Route incidents to Slack, Discord, Telegram, or your own webhook."
      />
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardContent>
              <div className="mb-4 flex justify-end">{ruleDialog}</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Min severity</TableHead>
                      <TableHead>Environments</TableHead>
                      <TableHead>Throttle</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rules.data ?? []).map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>{rule.channel?.name ?? rule.channelId}</TableCell>
                        <TableCell>
                          <StatusBadge value={rule.minSeverity} />
                        </TableCell>
                        <TableCell>{rule.environments.join(', ') || 'All'}</TableCell>
                        <TableCell className="tabular-nums">{rule.throttleMinutes}m</TableCell>
                        <TableCell className="text-right">
                          {mayManage && (
                            <DeleteButton
                              title="Delete this alert rule?"
                              description="Incidents will stop notifying this channel through this rule."
                              onConfirm={() => deleteRule.mutate(rule.id)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!rules.isLoading && !rules.data?.length && (
                <EmptyState message="No alert rules yet. Add a channel first, then a rule." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels">
          <Card>
            <CardContent>
              <div className="mb-4 flex justify-end">{channelDialog}</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(channels.data ?? []).map((channel) => (
                      <TableRow key={channel.id}>
                        <TableCell className="font-medium">{channel.name}</TableCell>
                        <TableCell>
                          <StatusBadge value={channel.type} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={channel.enabled ? 'active' : 'disabled'} />
                        </TableCell>
                        <TableCell>{formatDate(channel.createdAt)}</TableCell>
                        <TableCell className="flex justify-end gap-1">
                          {!mayManage && <span className="text-muted-foreground text-xs">Read only</span>}
                          {mayManage && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Send test alert"
                                disabled={testChannel.isPending}
                                onClick={() => testChannel.mutate(channel.id)}
                              >
                                <SendIcon />
                                <span className="sr-only">Send test alert</span>
                              </Button>
                              <DeleteButton
                                title="Delete this channel?"
                                description="Every rule pointing at this channel is deleted too."
                                onConfirm={() => deleteChannel.mutate(channel.id)}
                              />
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!channels.isLoading && !channels.data?.length && (
                <EmptyState message="No notification channels yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries">
          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(deliveries.data ?? []).map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>{formatDate(delivery.createdAt)}</TableCell>
                        <TableCell>{delivery.rule?.name ?? delivery.ruleId}</TableCell>
                        <TableCell>{delivery.trigger.replace('_', ' ').toLowerCase()}</TableCell>
                        <TableCell>
                          <StatusBadge value={delivery.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-sm truncate text-xs">
                          {delivery.error ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!deliveries.isLoading && !deliveries.data?.length && (
                <EmptyState message="No alerts have been delivered yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BellIcon className="text-muted-foreground size-8" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function DeleteButton({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title={title}>
          <Trash2Icon />
          <span className="sr-only">{title}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
