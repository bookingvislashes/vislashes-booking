"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    bufferMinutes: "15",
    advanceHours: "24",
    maxAdvanceDays: "60",
    businessName: "VIS Lashes",
    businessEmail: "",
    businessPhone: "",
    googleCalendarConnected: false,
  });

  const updateSetting = (key: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Settings
      </h1>

      {/* Scheduling Settings */}
      <div className="bg-white rounded-lg p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
        <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
          Scheduling
        </h2>
        <div className="flex flex-col gap-4 max-w-sm">
          <Input
            id="bufferMinutes"
            label="Buffer time between appointments (minutes)"
            type="number"
            value={settings.bufferMinutes}
            onChange={(e) => updateSetting("bufferMinutes", e.target.value)}
          />
          <Input
            id="advanceHours"
            label="Minimum advance booking time (hours)"
            type="number"
            value={settings.advanceHours}
            onChange={(e) => updateSetting("advanceHours", e.target.value)}
          />
          <Input
            id="maxAdvanceDays"
            label="Maximum advance booking (days)"
            type="number"
            value={settings.maxAdvanceDays}
            onChange={(e) => updateSetting("maxAdvanceDays", e.target.value)}
          />
        </div>
      </div>

      {/* Business Info */}
      <div className="bg-white rounded-lg p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
        <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
          Business Information
        </h2>
        <div className="flex flex-col gap-4 max-w-sm">
          <Input
            id="businessName"
            label="Business Name"
            value={settings.businessName}
            onChange={(e) => updateSetting("businessName", e.target.value)}
          />
          <Input
            id="businessEmail"
            label="Business Email"
            type="email"
            placeholder="bookings@vislashes.com"
            value={settings.businessEmail}
            onChange={(e) => updateSetting("businessEmail", e.target.value)}
          />
          <Input
            id="businessPhone"
            label="Business Phone"
            type="tel"
            placeholder="(407) 555-1234"
            value={settings.businessPhone}
            onChange={(e) => updateSetting("businessPhone", e.target.value)}
          />
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-lg p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
        <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
          Google Calendar
        </h2>
        <div className="flex items-center gap-4">
          <div
            className={`w-3 h-3 rounded-full ${
              settings.googleCalendarConnected ? "bg-success" : "bg-muted"
            }`}
          />
          <span className="font-sans text-[14px] text-charcoal">
            {settings.googleCalendarConnected ? "Connected" : "Not connected"}
          </span>
          <Button
            variant={settings.googleCalendarConnected ? "danger" : "primary"}
            size="sm"
            onClick={() =>
              updateSetting("googleCalendarConnected", !settings.googleCalendarConnected)
            }
          >
            {settings.googleCalendarConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </div>

      <Button>Save All Settings</Button>
    </div>
  );
}
