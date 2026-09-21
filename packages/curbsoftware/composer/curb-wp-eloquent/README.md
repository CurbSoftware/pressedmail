# CurbSoftware WpEloquent

> Eloquent ORM for WordPress - extracted from Laravel 8.9

The WpEloquent component is a full database toolkit for PHP, providing an expressive query builder, ActiveRecord style ORM, and schema builder. It currently supports MySQL, PostgreSQL, SQL Server, and SQLite.

This package is maintained by [CurbSoftware](https://www.curbsoftware.com) for use in WordPress plugin and theme development.

## Installation

This package is not published to Packagist. It is consumed through a Composer
`path` repository from the source tree beside the project that uses it. The
PressedMail plugin's `composer-free.json` is the worked example: from the
repository root,

```SH
cd apps/wp-pressedmail/plugin-files
COMPOSER=composer-free.json composer install --no-dev --optimize-autoloader
```

The path repository in that file points at this directory, so the install
resolves `curbsoftware/wp-eloquent` from here rather than from a registry.

## Configuration

### Using $wpdb connection (Recommended for WordPress)

```PHP
use CurbSoftware\WpEloquent\Application;

Application::bootWp();
```

This will automatically use your WordPress database connection via the global `$wpdb` object.

### Using a separate database connection

```PHP
use CurbSoftware\WpEloquent\Application;

Application::boot([
    'driver'    => 'mysql',
    'host'      => 'localhost',
    'database'  => 'database',
    'username'  => 'root',
    'password'  => 'password',
    'charset'   => 'utf8',
    'collation' => 'utf8_unicode_ci',
    'prefix'    => '',
]);
```

## Usage

### Using the Query Builder

```PHP
use CurbSoftware\WpEloquent\Support\Facades\DB;

$users = DB::table('users')->where('votes', '>', 100)->get();
```

Other core methods may be accessed directly from the Capsule:

```PHP
use CurbSoftware\WpEloquent\Support\Facades\DB;

$results = DB::select('select * from users where id = ?', [1]);
```

### Using the Schema Builder

```PHP
use CurbSoftware\WpEloquent\Support\Facades\Schema;

Schema::create('users', function ($table) {
    $table->increments('id');
    $table->string('email')->unique();
    $table->timestamps();
});
```

### Using the Eloquent ORM

```PHP
use CurbSoftware\WpEloquent\Database\Eloquent\Model;

class User extends Model {
    protected $table = 'users';
}

$users = User::where('votes', '>', 1)->get();
```

## Requirements

- PHP 7.3 or higher (compatible with PHP 8.0, 8.1, 8.2)
- PDO extension
- JSON extension

## Migration from prappo/wp-eloquent

If you're upgrading from the original `prappo/wp-eloquent` package:

1. Update your `composer.json` to require `curbsoftware/wp-eloquent` instead
2. Update all namespace references from `Prappo\WpEloquent` to `CurbSoftware\WpEloquent`
3. Run `composer update` to install the new package
4. Update your code to use the new namespace

Example migration:

**Before:**
```PHP
use Prappo\WpEloquent\Application;
use Prappo\WpEloquent\Support\Facades\DB;
use Prappo\WpEloquent\Database\Eloquent\Model;
```

**After:**
```PHP
use CurbSoftware\WpEloquent\Application;
use CurbSoftware\WpEloquent\Support\Facades\DB;
use CurbSoftware\WpEloquent\Database\Eloquent\Model;
```

## WordPress Integration

This package is specifically designed for WordPress integration:

- Automatically detects and uses WordPress database configuration
- Supports WordPress table prefixes via `$wpdb->prefix`
- Compatible with SQLite database plugins for WordPress
- Works seamlessly with WordPress cron and hooks

## Support

- **Documentation**: See [Laravel Documentation](https://laravel.com/docs/8.x/eloquent) for Eloquent usage patterns

## License

This package is open-sourced software licensed under the [MIT license](LICENSE.md).

## Contributing

Maintained by CurbSoftware for its own WordPress plugins. Changes belong in this
source tree, not in a published release.

## Credits

This package is extracted from Laravel 8.9. All credit goes to the Laravel team and original contributors.
