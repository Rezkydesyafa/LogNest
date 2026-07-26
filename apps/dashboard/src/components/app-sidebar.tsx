'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ActivityIcon,
  BellIcon,
  FileKeyIcon,
  GaugeIcon,
  LogOutIcon,
  ServerIcon,
  SettingsIcon,
  SirenIcon,
  TerminalIcon,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

const NAVIGATION = [
  { href: '/overview', label: 'Overview', icon: GaugeIcon },
  { href: '/services', label: 'Services', icon: ServerIcon },
  { href: '/logs', label: 'Logs', icon: TerminalIcon },
  { href: '/incidents', label: 'Incidents', icon: SirenIcon },
  { href: '/alerts', label: 'Alerts', icon: BellIcon },
  { href: '/api-keys', label: 'API Keys', icon: FileKeyIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="LogMind AI">
              <Link href="/overview">
                <ActivityIcon />
                <span className="font-semibold">LogMind AI</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={label}
                    isActive={
                      pathname === href || (href === '/incidents' && pathname.startsWith('/incidents/'))
                    }
                  >
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-1 group-data-[collapsible=icon]:flex-col">
          <span className="text-muted-foreground px-2 text-xs group-data-[collapsible=icon]:hidden">
            Theme
          </span>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start group-data-[collapsible=icon]:justify-center"
          onClick={logout}
        >
          <LogOutIcon data-icon="inline-start" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
