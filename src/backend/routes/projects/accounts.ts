import { Hono } from 'hono';
import * as accountService from '../../services/account-service';

const accounts = new Hono();

/**
 * GET /:projectId/accounts
 * Get all accounts for a project
 */
accounts.get('/:projectId/accounts', async c => {
  try {
    const projectId = c.req.param('projectId');
    const data = await accountService.getAccountsByProject(projectId);

    return c.json({ data });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch accounts',
      },
      500
    );
  }
});

/**
 * GET /:projectId/accounts/:id
 * Get a single account by ID
 */
accounts.get('/:projectId/accounts/:id', async c => {
  try {
    const id = parseInt(c.req.param('id'));
    const account = await accountService.getAccountById(id);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json({ data: account });
  } catch (error) {
    console.error('Error fetching account:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch account',
      },
      500
    );
  }
});

/**
 * POST /:projectId/accounts
 * Create a new account
 */
accounts.post('/:projectId/accounts', async c => {
  try {
    const projectId = c.req.param('projectId');
    const body = await c.req.json();

    const input: accountService.CreateAccountInput = {
      projectId,
      name: body.name,
      username: body.username,
      email: body.email,
      password: body.password,
      notes: body.notes,
      loginUrl: body.loginUrl,
    };

    const data = await accountService.createAccount(input);

    return c.json({
      data,
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Error creating account:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create account',
      },
      500
    );
  }
});

/**
 * PUT /:projectId/accounts/:id
 * Update an account
 */
accounts.put('/:projectId/accounts/:id', async c => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    const input: accountService.UpdateAccountInput = {
      name: body.name,
      username: body.username,
      email: body.email,
      password: body.password,
      notes: body.notes,
      loginUrl: body.loginUrl,
    };

    const data = await accountService.updateAccount(id, input);

    return c.json({
      data,
      message: 'Account updated successfully',
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update account',
      },
      500
    );
  }
});

/**
 * DELETE /:projectId/accounts/:id
 * Delete an account
 */
accounts.delete('/:projectId/accounts/:id', async c => {
  try {
    const id = parseInt(c.req.param('id'));
    await accountService.deleteAccount(id);

    return c.json({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete account',
      },
      500
    );
  }
});

export default accounts;
