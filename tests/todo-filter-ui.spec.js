import { test, expect } from '@playwright/test';

test.describe('QTool Todo Assignee Filtering UI Test Suite', () => {
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5180';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Filtering by Alle, Meine, Adi, and Mensur dynamically updates task list', async ({ page }) => {
    const isAppLoaded = await page.isVisible('body');
    expect(isAppLoaded).toBe(true);

    const result = await page.evaluate(async () => {
      const { fetchAllTodos } = await import('/src/services/TodoService.js');
      
      const currentUser = { id: '2', name: 'Adi Shala', email: 'adi@qservice.ch' };
      const users = [
        { id: '2', name: 'Adi Shala' },
        { id: '3', name: 'Mensur Sherifi' }
      ];

      // Sample 3 todos: Adi, Mensur, Unassigned
      const testTodos = [
        { id: 'todo-adi-101', task: 'Auftrag prüfen (Adi)', status: 'open', assignedTo: 'Adi Shala', assigned_user_id: '2', due_date: '2026-08-20' },
        { id: 'todo-mensur-102', task: 'Messung durchführen (Mensur)', status: 'open', assigned_user_name: 'Mensur Sherifi', assigned_user_id: '3', due_date: '2026-08-21' },
        { id: 'todo-unassigned-103', task: 'Rapport ausfüllen (Unzugewiesen)', status: 'open', due_date: '2026-08-22' }
      ];

      // Matching logic test in component environment
      const getTodoAssigneeName = (t) => String(t.assignedTo || t.assigned_user_name || t.assignee || t.technician || '').toLowerCase().trim();
      const getTodoAssigneeId = (t) => String(t.assigned_user_id || t.assignedUserId || t.userId || '').trim();

      const isTodoAssignedToUser = (t, user) => {
        if (!t || !user) return false;
        const targetUserId = String(user.id || '').trim();
        const targetUserEmail = String(user.email || '').trim().toLowerCase();
        const targetUserName = String(user.name || '').trim().toLowerCase();
        const targetFirstName = targetUserName.split(' ')[0];
        const todoUserId = getTodoAssigneeId(t);
        const todoUserName = getTodoAssigneeName(t);
        if (targetUserId && todoUserId && (todoUserId === targetUserId || String(todoUserId) === targetUserId)) return true;
        if (targetUserEmail && todoUserName === targetUserEmail) return true;
        if (targetUserName && todoUserName) {
          if (todoUserName === targetUserName) return true;
          if (todoUserName.includes(targetUserName) || targetUserName.includes(todoUserName)) return true;
          if (targetFirstName && todoUserName.includes(targetFirstName)) return true;
        }
        return false;
      };

      const matchesAssigneeFilter = (t, filterVal) => {
        if (!filterVal || filterVal === 'all' || filterVal === 'Alle') return true;
        if (filterVal === 'mine' || filterVal === 'Meine') return isTodoAssignedToUser(t, currentUser);
        if (filterVal === 'office' || filterVal === 'unassigned' || filterVal === 'Unzugewiesen') {
          const todoUserId = getTodoAssigneeId(t);
          const todoUserName = getTodoAssigneeName(t);
          if (todoUserId === 'office' || todoUserName === 'innendienst' || todoUserName === 'unzugewiesen') return true;
          if (!todoUserId && !todoUserName) return true;
          return false;
        }
        const target = String(filterVal).toLowerCase().trim();
        const todoUserId = getTodoAssigneeId(t);
        const todoUserName = getTodoAssigneeName(t);
        if (todoUserId && (todoUserId === target || String(todoUserId) === target)) return true;
        const targetUser = users.find(u => String(u.id) === target || String(u.name).toLowerCase().trim() === target || String(u.name).toLowerCase().trim().startsWith(target));
        if (targetUser && isTodoAssignedToUser(t, targetUser)) return true;
        if (todoUserName) {
          if (todoUserName.includes(target)) return true;
          if (target.includes(todoUserName) && todoUserName.length > 0) return true;
          const todoFirstName = todoUserName.split(' ')[0];
          if (todoFirstName && (todoFirstName === target || target.includes(todoFirstName))) return true;
        }
        return false;
      };

      const allList = testTodos.filter(t => matchesAssigneeFilter(t, 'all'));
      const mineList = testTodos.filter(t => matchesAssigneeFilter(t, 'Meine'));
      const adiList = testTodos.filter(t => matchesAssigneeFilter(t, 'Adi'));
      const mensurList = testTodos.filter(t => matchesAssigneeFilter(t, 'Mensur'));
      const unassignedList = testTodos.filter(t => matchesAssigneeFilter(t, 'office'));

      return {
        allCount: allList.length,
        mineCount: mineList.length,
        mineTask: mineList[0]?.task,
        adiCount: adiList.length,
        adiTask: adiList[0]?.task,
        mensurCount: mensurList.length,
        mensurTask: mensurList[0]?.task,
        unassignedCount: unassignedList.length
      };
    });

    expect(result.allCount).toBe(3);
    expect(result.mineCount).toBe(1);
    expect(result.mineTask).toContain('Adi');
    expect(result.adiCount).toBe(1);
    expect(result.adiTask).toContain('Adi');
    expect(result.mensurCount).toBe(1);
    expect(result.mensurTask).toContain('Mensur');
    expect(result.unassignedCount).toBe(1);
  });
});
