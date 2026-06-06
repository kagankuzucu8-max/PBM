// Backend API wrapper
import axios from "axios";
import { readStoredSupabaseSession } from "@/lib/supabase";
import { getRuntimeEnv } from "@/lib/runtimeEnv";

const BACKEND_URL = getRuntimeEnv("REACT_APP_BACKEND_URL");
const FUNCTION_API = getRuntimeEnv("REACT_APP_API_BASE") || (BACKEND_URL ? `${BACKEND_URL}/api` : "/api");
const SUPABASE_URL = getRuntimeEnv("REACT_APP_SUPABASE_URL");
const SUPABASE_ANON_KEY = getRuntimeEnv("REACT_APP_SUPABASE_ANON_KEY");
export const API = FUNCTION_API;

export const apiClient = axios.create({
  baseURL: API,
  timeout: 60000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = readStoredSupabaseSession()?.access_token;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (SUPABASE_URL) config.headers["x-pbm-supabase-url"] = SUPABASE_URL;
  if (SUPABASE_ANON_KEY) config.headers["x-pbm-supabase-anon-key"] = SUPABASE_ANON_KEY;
  return config;
});

export async function analyzeAsset(payload) {
  const { data } = await apiClient.post("/analyze", payload);
  return data;
}

export async function chatWithAI(payload) {
  const { data } = await apiClient.post("/chat", payload);
  return data;
}

export async function runPBMBrain(payload) {
  const { data } = await apiClient.post("/brain/analyze", payload);
  return data;
}

export async function exportMLTrainingData(params = {}) {
  const { data } = await apiClient.get("/ml/export", { params });
  return data;
}

export async function importMLMemory(payload) {
  const { data } = await apiClient.post("/ml/import", payload);
  return data;
}

export async function notifySocialPost(payload) {
  const { data } = await apiClient.post("/social/notify", payload);
  return data;
}

export async function listNotifications() {
  const { data } = await apiClient.get("/notifications");
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await apiClient.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await apiClient.post("/notifications/read-all");
  return data;
}

export async function getAccountStatus() {
  const { data } = await apiClient.get("/me");
  return data;
}

export async function listEducationVideos() {
  const { data } = await apiClient.get("/education/videos");
  return data;
}

export async function addEducationVideo(payload) {
  const { data } = await apiClient.post("/education/videos", payload);
  return data;
}

export async function deleteEducationVideo(id) {
  const { data } = await apiClient.delete(`/education/videos/${id}`);
  return data;
}
