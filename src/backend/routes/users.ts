import { Hono } from 'hono';
import { userInfo } from 'os';
import { userService } from '../services/user-service';

const users = new Hono();

users
  .get('/current', async c => {
    const osUser = userInfo();
    const username = osUser.username;

    // Generate initials from username (first 2 chars uppercase)
    const initials = username.slice(0, 2).toUpperCase();

    return c.json({
      name: username,
      email: ``,
      avatar: '',
      initials: initials,
    });
  })
  .get('/', async c => {
    const allUsers = await userService.getUsers();
    return c.json(allUsers);
  })
  .get('/:id', async c => {
    const id = c.req.param('id');
    const user = await userService.getUserById(id);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  })

  .post('/', async c => {
    const userData = await c.req.json();

    if (!userData.name || !userData.email) {
      return c.json({ error: 'Name and email are required' }, 400);
    }

    const newUser = await userService.createUser(userData);
    return c.json(newUser, 201);
  });

export default users;
