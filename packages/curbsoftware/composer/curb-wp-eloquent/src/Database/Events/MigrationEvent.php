<?php

namespace CurbSoftware\WpEloquent\Database\Events;

use CurbSoftware\WpEloquent\Contracts\Database\Events\MigrationEvent as MigrationEventContract;
use CurbSoftware\WpEloquent\Database\Migrations\Migration;

abstract class MigrationEvent implements MigrationEventContract
{
    /**
     * An migration instance.
     *
     * @var \CurbSoftware\WpEloquent\Database\Migrations\Migration
     */
    public $migration;

    /**
     * The migration method that was called.
     *
     * @var string
     */
    public $method;

    /**
     * Create a new event instance.
     *
     * @param  \CurbSoftware\WpEloquent\Database\Migrations\Migration  $migration
     * @param  string  $method
     * @return void
     */
    public function __construct(Migration $migration, $method)
    {
        $this->method = $method;
        $this->migration = $migration;
    }
}
