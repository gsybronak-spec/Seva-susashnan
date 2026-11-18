import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Layers,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Globe,
  Settings,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Sliders,
  FileText,
  AlertCircle,
} from "lucide-react";

import {
  adminGetCampaignDashboard,
  adminCreateCampaignZone,
  adminUpdateCampaignZone,
  adminDeleteCampaignZone,
  adminGetCampaignRegistrations,
  adminExportCampaignRegistrations,
  adminUpdateCampaign,
  adminGetCampaignEvents,
  adminAddEventToCampaign,
  adminUpdateCampaignEvent,
  adminDeleteCampaignEvent,
} from "@/lib/campaign.functions";
import { YOG_SNEH_MILAN_BRANDING, isYogSnehMilanCampaign } from "@/lib/campaign-branding";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CampaignDashboardProps = {
  campaignId: string;
  onBack: () => void;
  onManageEvent?: (eventId: string, action?: "settings" | "form" | "certificates") => void;
};

export function CampaignDashboard({ campaignId, onBack, onManageEvent }: CampaignDashboardProps) {
  const qc = useQueryClient();

  const getDashboard = useServerFn(adminGetCampaignDashboard);
  const createZoneFn = useServerFn(adminCreateCampaignZone);
  const updateZoneFn = useServerFn(adminUpdateCampaignZone);
  const deleteZoneFn = useServerFn(adminDeleteCampaignZone);
  const getRegistrationsFn = useServerFn(adminGetCampaignRegistrations);
  const exportRegistrationsFn = useServerFn(adminExportCampaignRegistrations);
  const updateCampaignFn = useServerFn(adminUpdateCampaign);

  const getEventsFn = useServerFn(adminGetCampaignEvents);
  const addEventFn = useServerFn(adminAddEventToCampaign);
  const updateEventFn = useServerFn(adminUpdateCampaignEvent);
  const deleteEventFn = useServerFn(adminDeleteCampaignEvent);

  const [activeTab, setActiveTab] = useState<"overview" | "events" | "zones" | "participants" | "branding">("overview");
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const pageSize = 50;

  // Zone Modal State
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneSlug, setZoneSlug] = useState("");
  const [zoneDesc, setZoneDesc] = useState("");
  const [zoneOrder, setZoneOrder] = useState<number>(0);
  const [zoneActive, setZoneActive] = useState<boolean>(true);

  // Event Modal State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventStatus, setEventStatus] = useState<"published" | "draft">("published");

  // 1. Load Campaign Dashboard Data
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["campaign-dashboard", campaignId],
    queryFn: () => getDashboard({ data: { campaignId } }),
  });

  // 2. Load Events for this Campaign
  const { data: eventsData, isLoading: isEventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["campaign-events", campaignId],
    queryFn: () => getEventsFn({ data: { campaignId } }),
  });

  // 3. Load Participants Data for Table
  const { data: participantsData, isLoading: isParticipantsLoading, refetch: refetchParticipants } = useQuery({
    queryKey: ["campaign-participants", campaignId, selectedZoneFilter, searchQuery, page],
    queryFn: () =>
      getRegistrationsFn({
        data: {
          campaignId,
          zoneId: selectedZoneFilter === "all" ? undefined : selectedZoneFilter,
          search: searchQuery.trim() || undefined,
          limit: pageSize,
          offset: page * pageSize,
        },
      }),
  });

  const campaign = dashboardData?.ok ? dashboardData.campaign : null;
  const stats = dashboardData?.ok ? dashboardData.stats : null;
  const zones = (dashboardData?.ok ? (dashboardData.zones || dashboardData.stats?.zoneStats) : []) ?? [];
  const campaignEvents = (eventsData?.ok ? eventsData.events : []) ?? [];

  const isSnehMilan = isYogSnehMilanCampaign({
    campaignId: campaign?.id,
    campaignSlug: campaign?.slug,
    campaignName: campaign?.name,
  });

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    }
  };

  // Add Event Mutation
  const addEventMutation = useMutation({
    mutationFn: async () => {
      if (!eventTitle.trim()) {
        throw new Error("Event title is required.");
      }
      return addEventFn({
        data: {
          campaignId,
          title: eventTitle.trim(),
          slug: eventSlug.trim() || undefined,
          event_date: eventDate || undefined,
          start_time: eventStartTime || undefined,
          end_time: eventEndTime || undefined,
          venue: eventVenue.trim() || undefined,
          description: eventDesc.trim() || undefined,
          publish_status: eventStatus,
        },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || "Failed to add event.");
        return;
      }
      toast.success("New event created under this campaign!");
      setEventModalOpen(false);
      resetEventForm();
      void qc.invalidateQueries({ queryKey: ["campaign-events", campaignId] });
      void qc.invalidateQueries({ queryKey: ["campaign-dashboard", campaignId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  // Update Event Mutation
  const updateEventMutation = useMutation({
    mutationFn: async () => {
      if (!editingEventId) throw new Error("No event selected to update");
      if (!eventTitle.trim()) throw new Error("Event title is required.");
      return updateEventFn({
        data: {
          eventId: editingEventId,
          campaignId,
          title: eventTitle.trim(),
          slug: eventSlug.trim(),
          event_date: eventDate || undefined,
          start_time: eventStartTime || undefined,
          end_time: eventEndTime || undefined,
          venue: eventVenue.trim() || undefined,
          description: eventDesc.trim() || undefined,
          publish_status: eventStatus,
        },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || "Failed to update event.");
        return;
      }
      toast.success("Event updated successfully.");
      setEventModalOpen(false);
      resetEventForm();
      void qc.invalidateQueries({ queryKey: ["campaign-events", campaignId] });
      void qc.invalidateQueries({ queryKey: ["campaign-dashboard", campaignId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  // Delete / Archive Event Mutation
  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => deleteEventFn({ data: { eventId, campaignId } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || "Failed to delete event.");
      toast.success(res.message);
      void qc.invalidateQueries({ queryKey: ["campaign-events", campaignId] });
      void qc.invalidateQueries({ queryKey: ["campaign-dashboard", campaignId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventTitle("");
    setEventSlug("");
    setEventDate("");
    setEventStartTime("");
    setEventEndTime("");
    setEventVenue("");
    setEventDesc("");
    setEventStatus("published");
  };

  // Create or Update Zone Mutation
  const saveZoneMutation = useMutation({
    mutationFn: async () => {
      if (!zoneName.trim() || !zoneSlug.trim()) {
        throw new Error("Zone name and slug are required.");
      }
      if (editingZoneId) {
        return updateZoneFn({
          data: {
            zoneId: editingZoneId,
            name: zoneName.trim(),
            slug: zoneSlug.trim().toLowerCase(),
            description: zoneDesc.trim() || null,
            displayOrder: zoneOrder,
            isActive: zoneActive,
          },
        });
      } else {
        return createZoneFn({
          data: {
            campaignId,
            name: zoneName.trim(),
            slug: zoneSlug.trim().toLowerCase(),
            description: zoneDesc.trim() || null,
            displayOrder: zoneOrder,
            isActive: zoneActive,
          },
        });
      }
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || "Failed to save zone.");
        return;
      }
      toast.success(editingZoneId ? "Zone updated successfully." : "Zone created successfully.");
      setZoneModalOpen(false);
      resetZoneForm();
      void qc.invalidateQueries({ queryKey: ["campaign-dashboard", campaignId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  // Toggle Zone Active Status
  const toggleZoneActiveMutation = useMutation({
    mutationFn: (zone: { id: string; name: string; slug: string; description: string | null; display_order: number; is_active: boolean }) =>
      updateZoneFn({
        data: {
          zoneId: zone.id,
          name: zone.name,
          slug: zone.slug,
          description: zone.description,
          displayOrder: zone.display_order,
          isActive: !zone.is_active,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || "Failed to update zone status.");
      toast.success("Zone status updated.");
      void qc.invalidateQueries({ queryKey: ["campaign-dashboard", campaignId] });
    },
  });

  // Delete Zone Mutation
  const deleteZoneMutation = useMutation({
    mutationFn: (zoneId: string) => deleteZoneFn({ data: { zoneId } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || "Failed to delete zone.");
      toast.success("Zone deleted.");
      void qc.invalidateQueries({ queryKey: ["campaign-dashboard", campaignId] });
    },
  });

  // Toggle Campaign Registration Status
  const toggleCampaignRegistration = useMutation({
    mutationFn: async () => {
      if (!campaign) return;
      const nextStatus = campaign.registration_status === "open" ? "closed" : "open";
      return updateCampaignFn({
        data: {
          id: campaign.id,
          registration_status: nextStatus,
        },
      });
    },
    onSuccess: (res) => {
      if (!res?.ok) return toast.error(res?.error || "Failed to update registration status.");
      toast.success("Campaign registration status updated.");
      void qc.invalidateQueries({ queryKey: ["campaign-dashboard", campaignId] });
    },
  });

  // Export CSV / Excel with BOM
  const [isExporting, setIsExporting] = useState(false);
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const res = await exportRegistrationsFn({
        data: {
          campaignId,
          zoneId: selectedZoneFilter === "all" ? undefined : selectedZoneFilter,
        },
      });

      if (!res.ok || !res.rows) {
        toast.error(res.error || "Export failed.");
        return;
      }

      const rows = res.rows as Array<{
        registration_number: string;
        full_name: string;
        mobile: string;
        gender: string | null;
        district: string | null;
        taluka: string | null;
        zone_name: string | null;
        referred_by: string | null;
        created_at: string;
      }>;

      if (rows.length === 0) {
        toast.info("No registrations to export.");
        return;
      }

      const headers = [
        "Registration Number",
        "Full Name",
        "Mobile",
        "Gender",
        "District",
        "Taluka",
        "Zone",
        "Referred By",
        "Registration Date",
      ];

      const csvRows = [headers.join(",")];
      for (const r of rows) {
        const line = [
          `"${r.registration_number || ""}"`,
          `"${(r.full_name || "").replace(/"/g, '""')}"`,
          `"${r.mobile || ""}"`,
          `"${r.gender || ""}"`,
          `"${(r.district || "").replace(/"/g, '""')}"`,
          `"${(r.taluka || "").replace(/"/g, '""')}"`,
          `"${(r.zone_name || "").replace(/"/g, '""')}"`,
          `"${r.referred_by || ""}"`,
          `"${new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}"`,
        ];
        csvRows.push(line.join(","));
      }

      const csvContent = csvRows.join("\r\n");
      // \ufeff ensures Excel opens UTF-8 Gujarati characters without mojibake
      const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeCampaignSlug = campaign?.slug || "campaign";
      a.download = `${safeCampaignSlug}_registrations_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} registrations successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const resetZoneForm = () => {
    setEditingZoneId(null);
    setZoneName("");
    setZoneSlug("");
    setZoneDesc("");
    setZoneOrder(zones.length + 1);
    setZoneActive(true);
  };

  const openAddZone = () => {
    resetZoneForm();
    setZoneOrder(zones.length + 1);
    setZoneModalOpen(true);
  };

  const openEditZone = (zone: { id: string; name: string; slug: string; description: string | null; display_order: number; is_active: boolean }) => {
    setEditingZoneId(zone.id);
    setZoneName(zone.name);
    setZoneSlug(zone.slug);
    setZoneDesc(zone.description || "");
    setZoneOrder(zone.display_order);
    setZoneActive(zone.is_active);
    setZoneModalOpen(true);
  };

  if (isDashboardLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading Campaign Dashboard…</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-destructive font-semibold">Campaign not found.</p>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns
        </Button>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://yogboard.in";
  const campaignPublicUrl = `${origin}/campaigns/${campaign.slug}`;
  const campaignRegisterUrl = `${origin}/campaigns/${campaign.slug}/register`;

  return (
    <div className="space-y-6">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />
              All Campaigns
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-foreground">{campaign.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{campaign.name}</h1>
            <Badge variant={campaign.publish_status === "published" ? "default" : "secondary"}>
              {campaign.publish_status}
            </Badge>
            <Badge
              variant={campaign.registration_status === "open" ? "default" : "destructive"}
              className={campaign.registration_status === "open" ? "bg-emerald-600" : ""}
            >
              Registration: {campaign.registration_status}
            </Badge>
            {isSnehMilan && (
              <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 font-medium">
                ✨ Yog Sneh Milan Branding
              </Badge>
            )}
          </div>
          {campaign.slogan && <p className="text-xs text-muted-foreground">{campaign.slogan}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCopy(campaignRegisterUrl, "Registration Link")}
            title="Copy Public Registration Link"
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copy Reg Link
          </Button>

          <Button size="sm" variant="outline" asChild>
            <a href={campaignPublicUrl} target="_blank" rel="noreferrer">
              <Globe className="h-4 w-4 mr-1.5" />
              Public Page
            </a>
          </Button>

          <Button size="sm" variant="outline" asChild>
            <a href={campaignRegisterUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Register Form
            </a>
          </Button>

          <Button
            size="sm"
            onClick={() => setEventModalOpen(true)}
            className="bg-[#0F3E3E] hover:bg-[#144D4D] text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Event
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              refetchDashboard();
              refetchEvents();
              refetchParticipants();
            }}
            title="Refresh Data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Registrations</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {stats?.totalRegistrations?.toLocaleString("en-IN") ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Total under this campaign
          </CardContent>
        </Card>

        <Card className="border border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Events in Campaign</CardDescription>
            <CardTitle className="text-2xl font-bold text-brand-primary">
              {campaignEvents.length} Events
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Dedicated sessions / programs
          </CardContent>
        </Card>

        <Card className="border border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Today's Registrations</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              +{stats?.todayRegistrations?.toLocaleString("en-IN") ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Since midnight (IST)
          </CardContent>
        </Card>

        <Card className="border border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Active Zones</CardDescription>
            <CardTitle className="text-2xl font-bold text-[#F59E0B]">
              {stats?.activeZonesCount ?? zones.filter((z) => z.is_active).length} / {zones.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Zone registration channels
          </CardContent>
        </Card>
      </div>

      {/* Main Campaign Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid grid-cols-5 w-full sm:w-[680px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events ({campaignEvents.length})</TabsTrigger>
          <TabsTrigger value="zones">Zones ({zones.length})</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Events Overview Quick Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-brand-primary" />
                  Events under this Campaign ({campaignEvents.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Each event runs independently with its own registration link, form, date, time, and participant list.
                </p>
              </div>
              <Button size="sm" onClick={() => setEventModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add New Event
              </Button>
            </div>

            {campaignEvents.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No events added to this campaign yet.</p>
                <Button size="sm" onClick={() => setEventModalOpen(true)} className="mt-3">
                  <Plus className="h-4 w-4 mr-1" /> Add First Event
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaignEvents.map((ev: any) => {
                  const eventRegUrl = `${origin}/${ev.slug}/register`;
                  const title = ev.general?.title || ev.slug;
                  return (
                    <Card key={ev.id} className="border bg-card hover:shadow-md transition-shadow">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={ev.publish_status === "published" ? "default" : "secondary"}>
                            {ev.publish_status}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">/{ev.slug}</span>
                        </div>
                        <CardTitle className="text-base font-bold text-foreground mt-2 line-clamp-1">
                          {title}
                        </CardTitle>
                        {ev.event_date && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3.5 w-3.5 text-brand-primary" />
                            <span>{ev.event_date}</span>
                            {ev.event_time && <span>• {ev.event_time}</span>}
                          </div>
                        )}
                        {ev.venue && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                            <span className="line-clamp-1">{ev.venue}</span>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-3">
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                          <span className="text-muted-foreground">Registrations</span>
                          <span className="font-bold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {ev.registration_count?.toLocaleString("en-IN") || 0} participants
                          </span>
                        </div>

                        {/* Direct Event Link */}
                        <div className="p-2 rounded-lg bg-muted/60 border border-border text-[11px] font-mono break-all line-clamp-1 select-all">
                          {eventRegUrl}
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-8"
                            onClick={() => handleCopy(eventRegUrl, `${title} Link`)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy Link
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild title="Open Event Registration">
                            <a href={eventRegUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingEventId(ev.id);
                              setEventTitle(ev.general?.title || ev.slug);
                              setEventSlug(ev.slug);
                              setEventDate(ev.event_date || "");
                              const times = (ev.event_time || "").split("-");
                              setEventStartTime(times[0]?.trim() || "");
                              setEventEndTime(times[1]?.trim() || "");
                              setEventVenue(ev.venue || "");
                              setEventDesc(ev.description || "");
                              setEventStatus(ev.publish_status || "published");
                              setEventModalOpen(true);
                            }}
                            title="Edit Event"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {onManageEvent && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8"
                              onClick={() => onManageEvent(ev.id, "settings")}
                              title="Configure Event Settings"
                            >
                              <Settings className="h-3.5 w-3.5 mr-1" /> Manage
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Zones Distribution Quick Section */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-brand-primary" />
                  Zone-Wise Distribution & Links ({zones.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Each zone provides a dedicated registration link with guaranteed zone attribution.
                </p>
              </div>
              <Button size="sm" onClick={openAddZone} variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add Zone
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {zones.map((z) => {
                const zoneUrl = `${origin}/campaigns/${campaign.slug}/zone/${z.slug}`;
                return (
                  <Card key={z.id} className={`border ${!z.is_active ? "opacity-70 bg-muted/30" : "bg-card"}`}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={z.is_active ? "default" : "secondary"} className={z.is_active ? "bg-emerald-600" : ""}>
                          {z.is_active ? "Active" : "Disabled"}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">/{z.slug}</span>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground mt-2 flex items-center justify-between">
                        <span>{z.name}</span>
                        <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                          {z.registration_count?.toLocaleString("en-IN") || 0}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-7"
                          onClick={() => handleCopy(zoneUrl, `${z.name} Link`)}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy Link
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild title="Open Zone Link">
                          <a href={zoneUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* 2. EVENTS MANAGEMENT TAB */}
        <TabsContent value="events" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Campaign Events & Sessions</h2>
              <p className="text-xs text-muted-foreground">
                Manage all events and sessions under <strong>{campaign.name}</strong>. Add new events without clashing with existing ones.
              </p>
            </div>
            <Button size="sm" onClick={() => setEventModalOpen(true)} className="bg-[#0F3E3E] hover:bg-[#144D4D] text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Add New Event
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Event Title</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Direct Link</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaignEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No events added under this campaign yet. Click "Add New Event" to create one.
                    </td>
                  </tr>
                ) : (
                  campaignEvents.map((ev: any) => {
                    const eventRegUrl = `${origin}/${ev.slug}/register`;
                    const title = ev.general?.title || ev.slug;
                    return (
                      <tr key={ev.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {title}
                          <p className="text-xs text-muted-foreground font-mono font-normal">slug: {ev.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {ev.event_date || "—"}
                          {ev.event_time && <span className="block text-[11px]">{ev.event_time}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {ev.venue || "Gujarat"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="font-bold">
                            {ev.registration_count?.toLocaleString("en-IN") || 0}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ev.publish_status === "published" ? "default" : "secondary"}>
                            {ev.publish_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleCopy(eventRegUrl, `${title} Link`)}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy Link
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                              title="Open Registration Page"
                            >
                              <a href={eventRegUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingEventId(ev.id);
                                setEventTitle(ev.general?.title || ev.slug);
                                setEventSlug(ev.slug);
                                setEventDate(ev.event_date || "");
                                const times = (ev.event_time || "").split("-");
                                setEventStartTime(times[0]?.trim() || "");
                                setEventEndTime(times[1]?.trim() || "");
                                setEventVenue(ev.venue || "");
                                setEventDesc(ev.description || "");
                                setEventStatus(ev.publish_status || "published");
                                setEventModalOpen(true);
                              }}
                              title="Edit Event"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {onManageEvent && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onManageEvent(ev.id, "settings")}
                                title="Configure Event Settings & Form Builder"
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove event "${title}" from this campaign?`)) {
                                  deleteEventMutation.mutate(ev.id);
                                }
                              }}
                              title="Delete or Archive Event"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 3. ZONES TAB */}
        <TabsContent value="zones" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Manage Campaign Zones</h2>
              <p className="text-xs text-muted-foreground">
                Add, edit, enable, or disable zones. Zones are fully dynamic and campaign-isolated.
              </p>
            </div>
            <Button size="sm" onClick={openAddZone}>
              <Plus className="h-4 w-4 mr-1" /> Add New Zone
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Zone Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Zone Link</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No zones found. Click "Add New Zone" above.
                    </td>
                  </tr>
                ) : (
                  zones.map((z) => {
                    const zoneUrl = `${origin}/campaigns/${campaign.slug}/zone/${z.slug}`;
                    return (
                      <tr key={z.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs">{z.display_order}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {z.name}
                          {z.description && <p className="text-xs text-muted-foreground font-normal">{z.description}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{z.slug}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="font-bold">
                            {z.registration_count || 0}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleZoneActiveMutation.mutate(z)}
                          >
                            {z.is_active ? (
                              <span className="flex items-center text-emerald-600 font-semibold gap-1">
                                <ToggleRight className="h-4 w-4" /> Active
                              </span>
                            ) : (
                              <span className="flex items-center text-muted-foreground gap-1">
                                <ToggleLeft className="h-4 w-4" /> Disabled
                              </span>
                            )}
                          </Button>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleCopy(zoneUrl, `${z.name} Link`)}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy Link
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditZone(z)} title="Edit Zone">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete zone "${z.name}"?`)) {
                                  deleteZoneMutation.mutate(z.id);
                                }
                              }}
                              title="Delete Zone"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 4. PARTICIPANTS TAB */}
        <TabsContent value="participants" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter by Zone & Search */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="w-48">
                <select
                  value={selectedZoneFilter}
                  onChange={(e) => {
                    setSelectedZoneFilter(e.target.value);
                    setPage(0);
                  }}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
                >
                  <option value="all">All Zones ({stats?.totalRegistrations || 0})</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.registration_count || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Name, Mobile, Reg Number..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </div>

            {/* Export Button */}
            <Button size="sm" onClick={handleExportCSV} disabled={isExporting} className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
              <Download className="h-4 w-4 mr-1.5" />
              {isExporting ? "Exporting…" : "Export CSV (Excel UTF-8)"}
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Reg. Number</th>
                  <th className="px-4 py-3">Participant Name</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Zone</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Referred By</th>
                  <th className="px-4 py-3">Registered At</th>
                </tr>
              </thead>
              <tbody>
                {isParticipantsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading participants…
                    </td>
                  </tr>
                ) : !participantsData?.ok || (participantsData.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No registrations found for this filter.
                    </td>
                  </tr>
                ) : (
                  (participantsData.rows as any[]).map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 text-xs">
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">
                        {p.registration_number}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{p.full_name}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{p.mobile}</td>
                      <td className="px-4 py-2.5">
                        {p.zone_name ? (
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[11px]">
                            📍 {p.zone_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">General</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.district || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {p.referred_by ? `Ref: ${p.referred_by}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {participantsData?.ok && (participantsData.total ?? 0) > pageSize && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, participantsData.total || 0)} of{" "}
                {participantsData.total} participants
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * pageSize >= (participantsData.total || 0)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 5. BRANDING TAB */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card className="border border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold">Campaign Header & Branding Preview</CardTitle>
              <CardDescription className="text-xs">
                {isSnehMilan
                  ? "Standardized official Yog Sneh Milan Gujarati 3-Line Header"
                  : "Independent branding colors and banner configured for this campaign."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {isSnehMilan ? (
                <div className="p-6 rounded-xl bg-amber-50/50 border border-amber-200 text-center space-y-2">
                  <div className="h-14 w-14 mx-auto rounded-full bg-white p-1 border shadow-xs">
                    <img src="/logo-gsyb.png" alt="GSYB Emblem" className="h-full w-full object-contain" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-900">{YOG_SNEH_MILAN_BRANDING.line1}</p>
                  <p className="text-base font-bold text-[#D97706]">{YOG_SNEH_MILAN_BRANDING.line2}</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#0F3E3E]">{YOG_SNEH_MILAN_BRANDING.line3}</p>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-border text-center space-y-2" style={{ backgroundColor: campaign.theme?.backgroundColor || "#FFF7F2" }}>
                  <h2 className="text-xl font-bold" style={{ color: campaign.theme?.primaryColor || "#9F3138" }}>
                    {campaign.name}
                  </h2>
                  {campaign.slogan && <p className="text-sm text-muted-foreground">{campaign.slogan}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Event Modal Dialog */}
      <Dialog
        open={eventModalOpen}
        onOpenChange={(open) => {
          setEventModalOpen(open);
          if (!open) resetEventForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEventId ? "Edit Event / ઈવેન્ટમાં ફેરફાર કરો" : "Add Event to Campaign / નવી ઈવેન્ટ ઉમેરો"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingEventId
                ? `Update details for this event under ${campaign.name}.`
                : `Create a new independent event or session under ${campaign.name}. It receives its own registration link and will not clash with any running event.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Event Title / કાર્યક્રમનું નામ <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. અમદાવાદ સત્ર, મોર્નિંગ યોગ શિબિર, સત્ર 2"
                value={eventTitle}
                onChange={(e) => {
                  setEventTitle(e.target.value);
                  if (!editingEventId && !eventSlug) {
                    setEventSlug(
                      e.target.value
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Event Slug (URL identifier)</Label>
              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <span>/</span>
                <Input
                  placeholder="event-slug"
                  value={eventSlug}
                  onChange={(e) => setEventSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="font-mono"
                  disabled={Boolean(editingEventId)}
                />
                <span>/register</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Event Date (તારીખ)</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Publish Status</Label>
                <select
                  value={eventStatus}
                  onChange={(e: any) => setEventStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-medium"
                >
                  <option value="published">Published (Live)</option>
                  <option value="draft">Draft (Hidden)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Time (શરૂઆત સમય)</Label>
                <Input
                  placeholder="06:00 AM"
                  value={eventStartTime}
                  onChange={(e) => setEventStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">End Time (સમાપ્તિ સમય)</Label>
                <Input
                  placeholder="08:00 AM"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Venue / સ્થળ</Label>
              <Input
                placeholder="e.g. સાબરમતી રિવરફ્રન્ટ, અમદાવાદ"
                value={eventVenue}
                onChange={(e) => setEventVenue(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description / વિગત (Optional)</Label>
              <Input
                placeholder="Brief event details"
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setEventModalOpen(false);
                resetEventForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => (editingEventId ? updateEventMutation.mutate() : addEventMutation.mutate())}
              disabled={addEventMutation.isPending || updateEventMutation.isPending}
              className="bg-[#0F3E3E] hover:bg-[#144D4D] text-white"
            >
              {addEventMutation.isPending || updateEventMutation.isPending
                ? "Saving…"
                : editingEventId
                  ? "Save Changes"
                  : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Zone Dialog Modal */}
      <Dialog open={zoneModalOpen} onOpenChange={setZoneModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingZoneId ? "Edit Zone" : "Add New Zone"}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure zone details. Every zone gets its own unique registration link and locked attribution.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Zone Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Zone 1, Zone 2, North Gujarat Zone"
                value={zoneName}
                onChange={(e) => {
                  setZoneName(e.target.value);
                  if (!editingZoneId && !zoneSlug) {
                    setZoneSlug(
                      e.target.value
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Zone Slug (URL identifier) <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <span>/campaigns/{campaign.slug}/zone/</span>
                <Input
                  placeholder="zone-1"
                  value={zoneSlug}
                  onChange={(e) => setZoneSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description (Optional)</Label>
              <Input
                placeholder="Brief description or designated areas"
                value={zoneDesc}
                onChange={(e) => setZoneDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Display Order</Label>
                <Input
                  type="number"
                  value={zoneOrder}
                  onChange={(e) => setZoneOrder(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-semibold mb-2">Zone Status</Label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zoneActive}
                    onChange={(e) => setZoneActive(e.target.checked)}
                    className="rounded border-input h-4 w-4"
                  />
                  <span>Active & Open for Registration</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setZoneModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveZoneMutation.mutate()} disabled={saveZoneMutation.isPending}>
              {saveZoneMutation.isPending ? "Saving…" : editingZoneId ? "Update Zone" : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
