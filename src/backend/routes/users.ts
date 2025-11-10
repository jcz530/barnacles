import { Hono } from 'hono';
import { userInfo } from 'os';
import { userService } from '../services/user-service';
import { loadUser, type UserContext } from '../middleware/user-loader';
import { BadRequestException } from '../exceptions/http-exceptions';

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
  .get('/:id', loadUser, async (c: UserContext) => {
    const user = c.get('user');
    return c.json(user);
  })

  .post('/', async c => {
    const userData = await c.req.json();

    if (!userData.name || !userData.email) {
      throw new BadRequestException('Name and email are required');
    }

    const newUser = await userService.createUser(userData);
    return c.json(newUser, 201);
  });

export default users;
