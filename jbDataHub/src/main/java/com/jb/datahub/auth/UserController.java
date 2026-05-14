package com.jb.datahub.auth;

import com.jb.datahub.auth.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "사용자 관리 API", description = "관리자 전용 — 사용자 계정 관리")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "사용자 목록 조회")
    public ResponseEntity<List<UserResponseDto>> list() {
        return ResponseEntity.ok(userService.findAll());
    }

    @PostMapping
    @Operation(summary = "사용자 생성")
    public ResponseEntity<UserResponseDto> create(@RequestBody UserCreateDto dto) {
        return ResponseEntity.ok(userService.create(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "사용자 정보 수정 (역할·활성화 상태)")
    public ResponseEntity<UserResponseDto> update(@PathVariable Long id,
                                                   @RequestBody UserUpdateDto dto) {
        return ResponseEntity.ok(userService.update(id, dto));
    }

    @PutMapping("/{id}/password")
    @Operation(summary = "비밀번호 변경")
    public ResponseEntity<Void> changePassword(@PathVariable Long id,
                                                @RequestBody ChangePasswordDto dto) {
        userService.changePassword(id, dto);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "사용자 삭제")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                        @AuthenticationPrincipal String me) {
        userService.delete(id, me);
        return ResponseEntity.ok().build();
    }
}
