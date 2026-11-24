import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { createAdmin } from '../src/lib/create-admin';
import { pool } from '../src/lib/auth';

if (!process.stdin.isTTY) {
  console.error('Для создания администратора нужен интерактивный терминал.');
  process.exitCode = 1;
} else {
  try {
    const emailReader = createInterface({ input: process.stdin, output: process.stdout });
    const email = await emailReader.question('Email администратора: ');
    emailReader.close();

    process.stdout.write('Пароль (ввод скрыт): ');
    const silent = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    const passwordReader = createInterface({ input: process.stdin, output: silent, terminal: true });
    const password = await passwordReader.question('');
    passwordReader.close();
    process.stdout.write('\n');

    await createAdmin(email, password);
    console.log('Администратор создан.');
  } catch {
    console.error('Не удалось создать администратора. Проверьте email, длину пароля и отсутствие существующей учётной записи.');
    process.exitCode = 1;
  }
}
await pool.end();
