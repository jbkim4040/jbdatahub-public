package com.jb.datahub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class JbDataHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(JbDataHubApplication.class, args);
    }

}
