using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace diplom_1.Migrations
{
    public partial class AddSafeDeleteRulesAndNewEntities : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- 1. Новые поля в существующих таблицах ---
            migrationBuilder.AddColumn<string>(
                name: "INN",
                table: "Organizations",
                type: "text",
                nullable: true);

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Branches",
                newName: "Address");

            // --- 2. Создание таблицы Comments ---
            migrationBuilder.CreateTable(
                name: "Comments",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Text = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(nullable: false, defaultValueSql: "NOW()"),
                    IsInternal = table.Column<bool>(nullable: false),
                    AuthorId = table.Column<int>(nullable: true),
                    RequestId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Comments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Comments_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Comments_Requests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "Requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // --- 3. Создание таблицы Attachments ---
            migrationBuilder.CreateTable(
                name: "Attachments",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    FilePath = table.Column<string>(type: "text", nullable: false),
                    UploadedAt = table.Column<DateTime>(nullable: false, defaultValueSql: "NOW()"),
                    RequestId = table.Column<int>(nullable: true),
                    CommentId = table.Column<int>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Attachments_Requests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "Requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Attachments_Comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "Comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // --- 4. Изменение поведения связей Request ---
            migrationBuilder.DropForeignKey(name: "FK_Requests_Users_CreatedById", table: "Requests");
            migrationBuilder.DropForeignKey(name: "FK_Requests_Organizations_OrganizationId", table: "Requests");
            migrationBuilder.DropForeignKey(name: "FK_Requests_Branches_BranchId", table: "Requests");
            migrationBuilder.DropForeignKey(name: "FK_Requests_Products_ProductId", table: "Requests");

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Users_CreatedById",
                table: "Requests",
                column: "CreatedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Organizations_OrganizationId",
                table: "Requests",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Branches_BranchId",
                table: "Requests",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Products_ProductId",
                table: "Requests",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // --- Индексы ---
            migrationBuilder.CreateIndex(
                name: "IX_Comments_AuthorId",
                table: "Comments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_RequestId",
                table: "Comments",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_RequestId",
                table: "Attachments",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_CommentId",
                table: "Attachments",
                column: "CommentId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Attachments");
            migrationBuilder.DropTable(name: "Comments");

            migrationBuilder.DropColumn(name: "INN", table: "Organizations");

            migrationBuilder.RenameColumn(
                name: "Address",
                table: "Branches",
                newName: "Name");

            // восстановим связи на Cascade
            migrationBuilder.DropForeignKey(name: "FK_Requests_Users_CreatedById", table: "Requests");
            migrationBuilder.DropForeignKey(name: "FK_Requests_Organizations_OrganizationId", table: "Requests");
            migrationBuilder.DropForeignKey(name: "FK_Requests_Branches_BranchId", table: "Requests");
            migrationBuilder.DropForeignKey(name: "FK_Requests_Products_ProductId", table: "Requests");

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Users_CreatedById",
                table: "Requests",
                column: "CreatedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Organizations_OrganizationId",
                table: "Requests",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Branches_BranchId",
                table: "Requests",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Products_ProductId",
                table: "Requests",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
