'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, ScrollTextIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatDate, queryString } from '@/lib/api';
import type { AuditLog, Page, ProjectMember } from '@/lib/types';
import { PaginationControls } from '@/components/pagination-controls';
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

const ROLES = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'] as const;

export default function SettingsPage() {
  const { projectId, loading, can } = useProject();
  const mayManage = can('manageMembers');
  const mayAudit = can('viewAuditLog');
  const client = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [page, setPage] = useState(1);

  const members = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api<ProjectMember[]>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId),
  });
  const auditLogs = useQuery({
    queryKey: ['audit-logs', projectId, page],
    queryFn: () =>
      api<Page<AuditLog>>(`/projects/${projectId}/audit-logs${queryString({ page, limit: 25 })}`),
    enabled: Boolean(projectId),
  });

  const refreshMembers = () => client.invalidateQueries({ queryKey: ['project-members', projectId] });

  const addMember = useMutation({
    mutationFn: (input: { email: string; role: string }) =>
      api<ProjectMember>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setInviteOpen(false);
      await refreshMembers();
      toast.success('Member added');
    },
    onError: (error) => toast.error(error.message),
  });
  const changeRole = useMutation({
    mutationFn: (input: { memberId: string; role: string }) =>
      api(`/projects/members/${input.memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: input.role }),
      }),
    onSuccess: async () => {
      await refreshMembers();
      toast.success('Role updated');
    },
    onError: (error) => toast.error(error.message),
  });
  const removeMember = useMutation({
    mutationFn: (memberId: string) => api(`/projects/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await refreshMembers();
      toast.success('Member removed');
    },
    onError: (error) => toast.error(error.message),
  });

  if (loading) return <PageLoading />;
  if (!projectId) return <ProjectRequired />;
  if (members.error) return <ErrorState error={members.error} />;

  const inviteDialog = (
    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
      <DialogTrigger asChild>
        <Button disabled={!mayManage} title={mayManage ? undefined : deniedReason('manageMembers')}>
          <PlusIcon data-icon="inline-start" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            addMember.mutate({ email: String(data.get('email')), role: String(data.get('role')) });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a project member</DialogTitle>
            <DialogDescription>
              The person must already have a LogMind account with this email.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            <Field>
              <FieldLabel htmlFor="member-email">Email</FieldLabel>
              <Input id="member-email" name="email" type="email" required />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select name="role" defaultValue="VIEWER">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={addMember.isPending}>
              {addMember.isPending && <Spinner data-icon="inline-start" />}Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <PageHeader title="Settings" description="Who can access this project, and what they changed." />
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {mayAudit && <TabsTrigger value="audit">Audit log</TabsTrigger>}
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardContent>
              <div className="mb-4 flex justify-end">{inviteDialog}</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(members.data ?? []).map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.user.email}</TableCell>
                        <TableCell>{member.user.name ?? '—'}</TableCell>
                        <TableCell>
                          <Select
                            defaultValue={member.role}
                            disabled={!mayManage}
                            onValueChange={(role) => changeRole.mutate({ memberId: member.id, role })}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role.charAt(0) + role.slice(1).toLowerCase()}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{formatDate(member.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {mayManage && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Remove member">
                                  <Trash2Icon />
                                  <span className="sr-only">Remove member</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove this member?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    They lose access to this project immediately.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeMember.mutate(member.id)}>
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!members.isLoading && !members.data?.length && (
                <EmptyState
                  icon={<UsersIcon className="text-muted-foreground size-8" />}
                  message="No members yet."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent>
              {auditLogs.error ? (
                <ErrorState error={auditLogs.error} />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Who</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(auditLogs.data?.items ?? []).map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(entry.createdAt)}</TableCell>
                            <TableCell>{entry.actorEmail ?? '—'}</TableCell>
                            <TableCell>
                              <StatusBadge value={entry.action} />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {entry.targetType}
                              {entry.targetId ? `:${entry.targetId.slice(0, 10)}…` : ''}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">{entry.ip ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {!auditLogs.isLoading && !auditLogs.data?.items.length && (
                    <EmptyState
                      icon={<ScrollTextIcon className="text-muted-foreground size-8" />}
                      message="Nothing has been changed in this project yet."
                    />
                  )}
                  {Boolean(auditLogs.data?.total) && (
                    <PaginationControls
                      page={page}
                      limit={auditLogs.data?.limit ?? 25}
                      total={auditLogs.data?.total ?? 0}
                      onPage={setPage}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {icon}
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
