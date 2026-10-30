import { useState } from "react";
import { Alert, Button, Paper, TextField } from "@mui/material";
import api from "../services/api.js";

export default function AccountPage({ user, onUserUpdated, onNotify }) {
  const [profile, setProfile] = useState({ name: user.name, email: user.email });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const updateProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    try {
      const { data } = await api.put("/auth/profile", profile);
      onUserUpdated(data.user);
      onNotify("Profile updated.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setError("");
    try {
      const { data } = await api.put("/auth/change-password", passwords);
      localStorage.setItem("edupredict-token", data.token);
      onUserUpdated(data.user);
      setPasswords({ currentPassword: "", newPassword: "" });
      onNotify("Password changed successfully.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to change your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="dashboard-page resource-page">
      <div className="page-heading-row">
        <div><div className="breadcrumb">Account <span>/</span> Profile</div><h1 className="greeting">My profile</h1></div>
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <div className="account-grid">
        <Paper className="account-panel" elevation={0}>
          <h2>Profile information</h2>
          <p>Update your name and email address. Your role is managed by an administrator.</p>
          <form className="resource-form" onSubmit={updateProfile}>
            <TextField label="Name" required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
            <TextField label="Email" type="email" required value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
            <TextField label="Role" value={user.role} disabled />
            <Button type="submit" variant="contained" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save profile"}</Button>
          </form>
        </Paper>
        <Paper className="account-panel" elevation={0}>
          <h2>Change password</h2>
          <p>Use your current password to confirm this change.</p>
          <form className="resource-form" onSubmit={changePassword}>
            <TextField label="Current password" type="password" required autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} />
            <TextField label="New password" type="password" required inputProps={{ minLength: 8, maxLength: 72 }} autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} />
            <Button type="submit" variant="contained" disabled={savingPassword}>{savingPassword ? "Saving..." : "Change password"}</Button>
          </form>
        </Paper>
      </div>
    </div>
  );
}
