<?php

namespace CurbSoftware\WpEloquent\Database;

use Doctrine\DBAL\Driver\PDOMySql\Driver as DoctrineDriver;
use CurbSoftware\WpEloquent\Database\Query\Grammars\MySqlGrammar as QueryGrammar;
use CurbSoftware\WpEloquent\Database\Query\Processors\MySqlProcessor;
use CurbSoftware\WpEloquent\Database\Schema\Grammars\MySqlGrammar as SchemaGrammar;
use CurbSoftware\WpEloquent\Database\Schema\MySqlBuilder;
use CurbSoftware\WpEloquent\Database\Schema\MySqlSchemaState;
use CurbSoftware\WpEloquent\Filesystem\Filesystem;
use PDO;

class MySqlConnection extends Connection
{
    /**
     * Determine if the connected database is a MariaDB database.
     *
     * @return bool
     */
    public function isMaria()
    {
        return strpos($this->getPdo()->getAttribute(PDO::ATTR_SERVER_VERSION), 'MariaDB') !== false;
    }

    /**
     * Get the default query grammar instance.
     *
     * @return \CurbSoftware\WpEloquent\Database\Query\Grammars\MySqlGrammar
     */
    protected function getDefaultQueryGrammar()
    {
        return $this->withTablePrefix(new QueryGrammar);
    }

    /**
     * Get a schema builder instance for the connection.
     *
     * @return \CurbSoftware\WpEloquent\Database\Schema\MySqlBuilder
     */
    public function getSchemaBuilder()
    {
        if (is_null($this->schemaGrammar)) {
            $this->useDefaultSchemaGrammar();
        }

        return new MySqlBuilder($this);
    }

    /**
     * Get the default schema grammar instance.
     *
     * @return \CurbSoftware\WpEloquent\Database\Schema\Grammars\MySqlGrammar
     */
    protected function getDefaultSchemaGrammar()
    {
        return $this->withTablePrefix(new SchemaGrammar);
    }

    /**
     * Get the schema state for the connection.
     *
     * @param  \CurbSoftware\WpEloquent\Filesystem\Filesystem|null  $files
     * @param  callable|null  $processFactory
     * @return \CurbSoftware\WpEloquent\Database\Schema\MySqlSchemaState
     */
    public function getSchemaState(?Filesystem $files = null, ?callable $processFactory = null)
    {
        return new MySqlSchemaState($this, $files, $processFactory);
    }

    /**
     * Get the default post processor instance.
     *
     * @return \CurbSoftware\WpEloquent\Database\Query\Processors\MySqlProcessor
     */
    protected function getDefaultPostProcessor()
    {
        return new MySqlProcessor;
    }

    /**
     * Get the Doctrine DBAL driver.
     *
     * @return \Doctrine\DBAL\Driver\PDOMySql\Driver
     */
    protected function getDoctrineDriver()
    {
        return new DoctrineDriver;
    }
}
