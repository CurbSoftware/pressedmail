<?php

namespace CurbSoftware\WpEloquent\Support\Facades;

/**
 * @method static \CurbSoftware\WpEloquent\Database\Schema\Builder create(string $table, \Closure $callback)
 * @method static \CurbSoftware\WpEloquent\Database\Schema\Builder disableForeignKeyConstraints()
 * @method static \CurbSoftware\WpEloquent\Database\Schema\Builder drop(string $table)
 * @method static \CurbSoftware\WpEloquent\Database\Schema\Builder dropIfExists(string $table)
 * @method static \CurbSoftware\WpEloquent\Database\Schema\Builder enableForeignKeyConstraints()
 * @method static \CurbSoftware\WpEloquent\Database\Schema\Builder rename(string $from, string $to)
 * @method static \CurbSoftware\WpEloquent\Database\Schema\Builder table(string $table, \Closure $callback)
 * @method static bool hasColumn(string $table, string $column)
 * @method static bool hasColumns(string $table, array $columns)
 * @method static bool hasTable(string $table)
 * @method static void defaultStringLength(int $length)
 * @method static void registerCustomDoctrineType(string $class, string $name, string $type)
 *
 * @see \CurbSoftware\WpEloquent\Database\Schema\Builder
 */
class Schema extends Facade
{
    /**
     * Get a schema builder instance for a connection.
     *
     * @param  string|null  $name
     * @return \CurbSoftware\WpEloquent\Database\Schema\Builder
     */
    public static function connection($name)
    {
        return static::$app['db']->connection($name)->getSchemaBuilder();
    }

    /**
     * Get a schema builder instance for the default connection.
     *
     * @return \CurbSoftware\WpEloquent\Database\Schema\Builder
     */
    protected static function getFacadeAccessor()
    {
        return static::$app['db']->connection()->getSchemaBuilder();
    }
}
