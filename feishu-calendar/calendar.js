'use strict';
/**
 * feishu-calendar: Feishu calendar and event management via user OAuth.
 *
 * Usage:
 *   node calendar.js --action <action> --open-id <open_id> [options]
 *
 * Actions:
 *   list_calendars       - List user's calendars
 *   get_primary          - Get primary calendar
 *   create_event         - Create calendar event
 *   list_events          - List events in a calendar
 *   get_event            - Get event details
 *   update_event         - Update event
 *   delete_event         - Delete event
 *   search_events        - Search events
 *   add_attendees        - Add attendees to event
 *   list_attendees       - List event attendees
 *   remove_attendees     - Remove attendees from event
 *   check_freebusy       - Check free/busy status
 */

const path = require('path');
const { getConfig, getValidToken } = require(
  path.join(__dirname, '../feishu-auth/token-utils.js'),
);

function parseArgs() {
  const argv = process.argv.slice(2);
  const r = {
    action: null, openId: null, calendarId: null, eventId: null,
    summary: null, description: null, startTime: null, endTime: null,
    timeZone: 'Asia/Shanghai', location: null, attendees: null,
    query: null, pageSize: 50, pageToken: null,
    userIds: null, startMin: null, startMax: null,
    isAllDay: false, recurrence: null, reminder: null,
    needAttendee: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--action':       r.action       = argv[++i]; break;
      case '--open-id':      r.openId       = argv[++i]; break;
      case '--calendar-id':  r.calendarId   = argv[++i]; break;
      case '--event-id':     r.eventId      = argv[++i]; break;
      case '--summary':      r.summary      = argv[++i]; break;
      case '--description':  r.description  = argv[++i]; break;
      case '--start-time':   r.startTime    = argv[++i]; break;
      case '--end-time':     r.endTime      = argv[++i]; break;
      case '--time-zone':    r.timeZone     = argv[++i]; break;
      case '--location':     r.location     = argv[++i]; break;
      case '--attendees':    r.attendees    = argv[++i]; break;
      case '--query':        r.query        = argv[++i]; break;
      case '--page-size':    r.pageSize     = parseInt(argv[++i], 10); break;
      case '--page-token':   r.pageToken    = argv[++i]; break;
      case '--user-ids':     r.userIds      = argv[++i]; break;
      case '--start-min':    r.startMin     = argv[++i]; break;
      case '--start-max':    r.startMax     = argv[++i]; break;
      case '--all-day':      r.isAllDay     = true; break;
      case '--need-attendee': r.needAttendee = true; break;
    }
  }
  return r;
}

function out(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
function die(obj) { out(obj); process.exit(1); }

async function apiCall(method, urlPath, token, body, query) {
  let url = `https://open.feishu.cn/open-apis${urlPath}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function toTimestamp(dateStr) {
  return String(Math.floor(new Date(dateStr).getTime() / 1000));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function listCalendars(args, token) {
  const query = { page_size: String(args.pageSize) };
  if (args.pageToken) query.page_token = args.pageToken;
  const data = await apiCall('GET', '/calendar/v4/calendars', token, null, query);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ calendars: data.data?.calendar_list || [], has_more: data.data?.has_more, page_token: data.data?.page_token });
}

async function getPrimary(args, token) {
  const data = await apiCall('POST', '/calendar/v4/calendars/primary', token, {});
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ calendar: data.data?.calendars?.[0]?.calendar || data.data });
}

async function createEvent(args, token) {
  const calId = args.calendarId || 'primary';
  const body = {
    summary: args.summary || '未命名日程',
    description: args.description || '',
    start_time: args.isAllDay
      ? { date: args.startTime }
      : { timestamp: toTimestamp(args.startTime), timezone: args.timeZone },
    end_time: args.isAllDay
      ? { date: args.endTime }
      : { timestamp: toTimestamp(args.endTime), timezone: args.timeZone },
  };
  if (args.location) body.location = { name: args.location };
  if (args.attendees) {
    body.attendees = args.attendees.split(',').map(id => ({
      type: 'user', user_id: id.trim(), is_optional: false,
    }));
  }
  const query = { user_id_type: 'open_id' };
  if (args.needAttendee) query.need_attendee = 'true';
  const data = await apiCall('POST', `/calendar/v4/calendars/${calId}/events`, token, body, query);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ event: data.data?.event, reply: `日程「${args.summary}」已创建` });
}

async function listEvents(args, token) {
  const calId = args.calendarId || 'primary';
  const query = { page_size: String(Math.min(args.pageSize, 500)) };
  if (args.pageToken) query.page_token = args.pageToken;
  if (args.startMin) query.start_time = toTimestamp(args.startMin);
  if (args.startMax) query.end_time = toTimestamp(args.startMax);
  const data = await apiCall('GET', `/calendar/v4/calendars/${calId}/events`, token, null, query);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ events: data.data?.items || [], has_more: data.data?.has_more, page_token: data.data?.page_token });
}

async function getEvent(args, token) {
  if (!args.eventId) die({ error: 'missing_param', message: '--event-id 必填' });
  const calId = args.calendarId || 'primary';
  const query = { user_id_type: 'open_id' };
  if (args.needAttendee) query.need_attendee = 'true';
  const data = await apiCall('GET', `/calendar/v4/calendars/${calId}/events/${args.eventId}`, token, null, query);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ event: data.data?.event });
}

async function updateEvent(args, token) {
  if (!args.eventId) die({ error: 'missing_param', message: '--event-id 必填' });
  const calId = args.calendarId || 'primary';
  const body = {};
  if (args.summary) body.summary = args.summary;
  if (args.description) body.description = args.description;
  if (args.startTime) body.start_time = args.isAllDay ? { date: args.startTime } : { timestamp: toTimestamp(args.startTime), timezone: args.timeZone };
  if (args.endTime) body.end_time = args.isAllDay ? { date: args.endTime } : { timestamp: toTimestamp(args.endTime), timezone: args.timeZone };
  if (args.location) body.location = { name: args.location };
  const data = await apiCall('PATCH', `/calendar/v4/calendars/${calId}/events/${args.eventId}`, token, body, { user_id_type: 'open_id' });
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ event: data.data?.event, reply: '日程已更新' });
}

async function deleteEvent(args, token) {
  if (!args.eventId) die({ error: 'missing_param', message: '--event-id 必填' });
  const calId = args.calendarId || 'primary';
  const data = await apiCall('DELETE', `/calendar/v4/calendars/${calId}/events/${args.eventId}`, token);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ success: true, reply: '日程已删除' });
}

async function searchEvents(args, token) {
  if (!args.query) die({ error: 'missing_param', message: '--query 必填' });
  const calId = args.calendarId || 'primary';
  const body = { query: args.query };
  const query = { page_size: String(Math.min(args.pageSize, 50)), user_id_type: 'open_id' };
  if (args.pageToken) query.page_token = args.pageToken;
  const data = await apiCall('POST', `/calendar/v4/calendars/${calId}/events/search`, token, body, query);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ events: data.data?.items || [], has_more: data.data?.has_more, page_token: data.data?.page_token });
}

async function addAttendees(args, token) {
  if (!args.eventId) die({ error: 'missing_param', message: '--event-id 必填' });
  if (!args.attendees) die({ error: 'missing_param', message: '--attendees 必填' });
  const calId = args.calendarId || 'primary';
  const body = {
    attendees: args.attendees.split(',').map(id => ({ type: 'user', user_id: id.trim() })),
  };
  const data = await apiCall('POST', `/calendar/v4/calendars/${calId}/events/${args.eventId}/attendees`, token, body, { user_id_type: 'open_id' });
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ attendees: data.data?.attendees, reply: '参与者已添加' });
}

async function listAttendees(args, token) {
  if (!args.eventId) die({ error: 'missing_param', message: '--event-id 必填' });
  const calId = args.calendarId || 'primary';
  const query = { page_size: String(args.pageSize), user_id_type: 'open_id' };
  if (args.pageToken) query.page_token = args.pageToken;
  const data = await apiCall('GET', `/calendar/v4/calendars/${calId}/events/${args.eventId}/attendees`, token, null, query);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ attendees: data.data?.items || [], has_more: data.data?.has_more, page_token: data.data?.page_token });
}

async function removeAttendees(args, token) {
  if (!args.eventId) die({ error: 'missing_param', message: '--event-id 必填' });
  if (!args.attendees) die({ error: 'missing_param', message: '--attendees 必填' });
  const calId = args.calendarId || 'primary';
  const body = {
    attendee_ids: args.attendees.split(',').map(id => id.trim()),
  };
  const data = await apiCall('POST', `/calendar/v4/calendars/${calId}/events/${args.eventId}/attendees/batch_delete`, token, body);
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ success: true, reply: '参与者已移除' });
}

async function checkFreebusy(args, token) {
  if (!args.userIds) die({ error: 'missing_param', message: '--user-ids 必填' });
  if (!args.startTime || !args.endTime) die({ error: 'missing_param', message: '--start-time 和 --end-time 必填' });
  const body = {
    time_min: toTimestamp(args.startTime),
    time_max: toTimestamp(args.endTime),
    user_ids: args.userIds.split(',').map(id => ({ user_id: id.trim(), type: 'user' })),
  };
  const data = await apiCall('POST', '/calendar/v4/freebusy/list', token, body, { user_id_type: 'open_id' });
  if (data.code !== 0) throw new Error(`code=${data.code} msg=${data.msg}`);
  out({ freebusy_list: data.data?.freebusy_list || [] });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ACTIONS = {
  list_calendars: listCalendars,
  get_primary: getPrimary,
  create_event: createEvent,
  list_events: listEvents,
  get_event: getEvent,
  update_event: updateEvent,
  delete_event: deleteEvent,
  search_events: searchEvents,
  add_attendees: addAttendees,
  list_attendees: listAttendees,
  remove_attendees: removeAttendees,
  check_freebusy: checkFreebusy,
};

async function main() {
  const args = parseArgs();
  if (!args.openId) die({ error: 'missing_param', message: '--open-id 参数必填' });
  if (!args.action) die({ error: 'missing_param', message: `--action 参数必填。可选: ${Object.keys(ACTIONS).join(', ')}` });

  const handler = ACTIONS[args.action];
  if (!handler) die({ error: 'invalid_action', message: `未知操作: ${args.action}。可选: ${Object.keys(ACTIONS).join(', ')}` });

  let cfg;
  try { cfg = getConfig(__dirname); } catch (err) { die({ error: 'config_error', message: err.message }); }

  let accessToken;
  try { accessToken = await getValidToken(args.openId, cfg.appId, cfg.appSecret); } catch (err) {
    die({ error: 'token_error', message: err.message });
  }
  if (!accessToken) {
    die({ error: 'auth_required', message: `用户未授权。open_id: ${args.openId}` });
  }

  try {
    await handler(args, accessToken);
  } catch (err) {
    if (err.message?.includes('99991663')) die({ error: 'auth_required', message: 'token 已失效，请重新授权' });
    const msg = err.message || '';
    if (msg.includes('99991400')) {
      die({ error: 'rate_limited', message: msg || '请求频率超限，请稍后重试' });
    }
    if (msg.includes('99991672') || msg.includes('99991679') || /permission|scope|not support|tenant/i.test(msg)) {
      die({
        error: 'permission_required',
        message: msg,
        required_scopes: ['calendar:calendar', 'calendar:calendar:read', 'calendar:calendar.event:create', 'calendar:calendar.event:read', 'calendar:calendar.event:update', 'calendar:calendar.event:delete', 'calendar:calendar.free_busy:read'],
        reply: '⚠️ **权限不足，需要重新授权以获取所需权限。**',
      });
    }
    die({ error: 'api_error', message: err.message });
  }
}

main();
